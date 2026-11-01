import type { ChildProcess } from 'node:child_process';

/** Lifecycle for a detached fixture process group that we own until close/error. */
export function fixtureProcess(
  child: ChildProcess,
  stops: Set<() => Promise<void>>,
  onError: (error: Error) => void,
  gracePeriod = 1500,
) {
  let finished = false;
  const completion = new Promise<number | null>(resolve => {
    child.once('error', error => { finished = true; onError(error); resolve(null); });
    child.once('close', code => { finished = true; resolve(code); });
  });
  const signal = (name: NodeJS.Signals) => {
    // A reaped PID is no longer ours and may already identify an unrelated group.
    if (finished || !child.pid) return;
    try { process.kill(-child.pid, name); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
  };
  const wait = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([completion, new Promise<void>(resolve => { timer = setTimeout(resolve, gracePeriod); })]);
    } finally { clearTimeout(timer); }
  };
  let stopping: Promise<void> | undefined;
  const stop = () => stopping ??= (async () => {
    signal('SIGTERM');
    await wait();
    // Escalate only while the owned child has not closed or failed.
    signal('SIGKILL');
    await wait();
    stops.delete(stop);
  })();
  stops.add(stop);
  return { completion, stop, finished: () => finished };
}
