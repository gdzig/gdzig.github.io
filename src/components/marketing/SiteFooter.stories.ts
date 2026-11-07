import SiteFooterCanvas from '../../../.storybook/SiteFooterCanvas.astro';

export default {
  title: 'Marketing/SiteFooter',
  component: SiteFooterCanvas,
  args: { kind: 'footer' },
};

export const Light = { args: { theme: 'light' } };
export const Dark = { args: { theme: 'dark' } };
