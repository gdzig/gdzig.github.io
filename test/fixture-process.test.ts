import { expect, spyOn, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createBlogSite } from './helpers/blog-site';
import { fixtureProcess } from './helpers/fixture-process';

const launch = (script: string, gracePeriod = 100) => {
  const child = spawn(process.execPath, ['-e', script], {
    detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stops = new Set<() => Promise<void>>();
  const errors: Error[] = [];
  const lifecycle = fixtureProcess(child, stops, error => errors.push(error), gracePeriod);
  return { child, stops, errors, ...lifecycle };
};
const ready = `console.log('ready'); setInterval(() => {}, 1000);`;

// Real build coverage for the original finally -> stop path, without faking a child.
test('a completed real blog build does not signal its reaped process group', async () => {
  const site = await createBlogSite();
  const kill = process.kill.bind(process);
  const signals: Array<{ pid: number; signal: string | number | undefined }> = [];
  const spy = spyOn(process, 'kill').mockImplementation((pid, signal) => {
    if (pid < 0) signals.push({ pid, signal });
    return kill(pid, signal);
  });
  try {
    const result = await site.build();
    expect(result.status, JSON.stringify(result)).toBe(0);
    expect(signals).toEqual([]);
  } finally {
    spy.mockRestore();
    await site.dispose();
  }
}, 180_000);

test('stop never targets a stale PID, even if that group would now reject with EPERM', async () => {
  const process = launch('process.exit(0)');
  expect(await process.completion).toBe(0);
  const denied = Object.assign(new Error('stale group is not ours'), { code: 'EPERM' });
  const kill = spyOn(globalThis.process, 'kill').mockImplementation(() => { throw denied; });
  try {
    await process.stop();
    expect(kill).not.toHaveBeenCalled();
    expect(process.finished()).toBe(true);
    expect(process.stops.size).toBe(0);
  } finally { kill.mockRestore(); }
});

test('a live owned process exits on TERM without a later KILL and stop is idempotent', async () => {
  const process = launch(`process.on('SIGTERM', () => process.exit(0)); ${ready}`);
  await once(process.child.stdout!, 'data');
  const kill = globalThis.process.kill.bind(globalThis.process);
  const signals: unknown[] = [];
  const spy = spyOn(globalThis.process, 'kill').mockImplementation((pid, signal) => {
    signals.push(signal);
    return kill(pid, signal);
  });
  try {
    const stopping = process.stop();
    expect(process.stop()).toBe(stopping);
    await stopping;
    expect(await process.completion).toBe(0);
    expect(signals).toEqual(['SIGTERM']);
    expect(process.stops.size).toBe(0);
  } finally {
    spy.mockRestore();
    if (!process.finished()) kill(-process.child.pid!, 'SIGKILL');
    await process.completion;
  }
});

test('a live process ignoring TERM is killed after the bounded grace period', async () => {
  const process = launch(`process.on('SIGTERM', () => {}); ${ready}`, 50);
  await once(process.child.stdout!, 'data');
  const started = Date.now();
  try {
    await process.stop();
    await process.completion;
    expect(process.child.signalCode).toBe('SIGKILL');
    expect(Date.now() - started).toBeLessThan(2000);
    expect(process.finished()).toBe(true);
  } finally {
    if (!process.finished()) globalThis.process.kill(-process.child.pid!, 'SIGKILL');
    await process.completion;
  }
});

test('EPERM while signaling a live owned process remains a cleanup error', async () => {
  const process = launch(ready);
  await once(process.child.stdout!, 'data');
  const denied = Object.assign(new Error('live group permission failure'), { code: 'EPERM' });
  const kill = spyOn(globalThis.process, 'kill').mockImplementation(() => { throw denied; });
  try {
    await expect(process.stop()).rejects.toBe(denied);
    expect(process.finished()).toBe(false);
    expect(process.stops.size).toBe(1);
  } finally {
    kill.mockRestore();
    globalThis.process.kill(-process.child.pid!, 'SIGKILL');
    await process.completion;
  }
});

test.each(['ESRCH', 'no close event'])('cleanup remains bounded with %s', async outcome => {
  const process = launch(ready, 25);
  await once(process.child.stdout!, 'data');
  // Keep the real child alive to exercise both deadline paths deterministically.
  const signals: unknown[] = [];
  const kill = spyOn(globalThis.process, 'kill').mockImplementation((_pid, signal) => {
    signals.push(signal);
    if (outcome === 'ESRCH') throw Object.assign(new Error('group disappeared'), { code: 'ESRCH' });
    return true;
  });
  try {
    const started = Date.now();
    await process.stop();
    expect(Date.now() - started).toBeLessThan(2000);
    expect(signals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(process.finished()).toBe(false);
  } finally {
    kill.mockRestore();
    globalThis.process.kill(-process.child.pid!, 'SIGKILL');
    await process.completion;
  }
});

test('a failed spawn completes with diagnostics and needs no signaling', async () => {
  const child = spawn('/this-fixture-executable-does-not-exist', [], { detached: true });
  const errors: Error[] = [];
  const stops = new Set<() => Promise<void>>();
  const process = fixtureProcess(child, stops, error => errors.push(error), 50);
  expect(await process.completion).toBeNull();
  await process.stop();
  expect(errors).toHaveLength(1);
  expect(process.finished()).toBe(true);
  expect(stops.size).toBe(0);
});
