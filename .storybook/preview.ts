import '@picocss/pico/css/pico.conditional.min.css';
import '../src/styles/home.css';
import '../src/styles/landing.css';
import { initializeTheme } from '../src/components/marketing/theme.js';
import type { Preview } from '@storybook-astro/framework';

export default {
  parameters: { layout: 'fullscreen' },
  globalTypes: {
    theme: {
      description: 'Canvas color theme',
      toolbar: {
        icon: 'circlehollow',
        dynamicTitle: true,
        items: [
          { value: 'story', title: 'Story theme' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
          { value: 'system', title: 'System' },
        ],
      },
    },
  },
  initialGlobals: { theme: 'story' },
  decorators: [
    (Story, context) => {
      // The Astro adapter also composes decorators while prerendering static stories.
      if (typeof document === 'undefined') return Story();
      const selected = context.globals.theme === 'story' ? context.args.theme : context.globals.theme;
      // Presets configure the fixture. The actual production theme code applies it.
      try {
        if (selected === 'system') localStorage.removeItem('starlight-theme');
        else if (selected === 'light' || selected === 'dark') localStorage.setItem('starlight-theme', selected);
      } catch { /* Production theme policy also supports unavailable storage. */ }
      document.body.classList.add('pico', 'home-page');
      if (context.args.kind === 'action' || context.args.overlay) document.body.dataset.page = 'landing';
      else delete document.body.dataset.page;
      initializeTheme();
      return Story();
    },
  ],
} satisfies Preview;
