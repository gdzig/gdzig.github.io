import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchForWorkspaceRoot } from 'vite';
import type { StorybookConfig } from '@storybook-astro/framework';

export default {
  stories: ['../src/components/marketing/*.stories.ts'],
  framework: { name: '@storybook-astro/framework', options: {} },
  core: { disableTelemetry: true },
  async viteFinal(config) {
    return {
      ...config,
      cacheDir: resolve(import.meta.dirname, '../.storybook-cache/vite'),
      // Isolated browser fixtures link installed dependencies outside their root.
      // Allow only Storybook's own runtime package, preserving Vite's file guard.
      server: {
        ...config.server,
        fs: {
          ...config.server?.fs,
          allow: [
            ...(config.server?.fs?.allow ?? [searchForWorkspaceRoot(process.cwd())]),
            dirname(fileURLToPath(import.meta.resolve('storybook/package.json'))),
          ],
        },
      },
      // The adapter omits astro:prefetch's transform, while Starlight injects its
      // page script. The component canvas must not prefetch production routes.
      define: {
        ...config.define,
        __PREFETCH_PREFETCH_ALL__: 'false',
        __PREFETCH_DEFAULT_STRATEGY__: JSON.stringify('hover'),
        __EXPERIMENTAL_CLIENT_PRERENDER__: 'false',
      },
      // Do not scan production pages and their server-only content collections.
      optimizeDeps: { ...config.optimizeDeps, entries: ['.storybook/preview.ts', 'src/components/marketing/*.stories.ts'] },
    };
  },
} satisfies StorybookConfig;
