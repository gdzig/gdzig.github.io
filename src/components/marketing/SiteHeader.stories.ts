import MarketingCanvas from '../../../.storybook/MarketingCanvas.astro';

export default {
  title: 'Marketing/SiteHeader',
  component: MarketingCanvas,
  args: { kind: 'header', overlay: false },
};

export const DefaultLight = { args: { theme: 'light' } };
export const DefaultDark = { args: { theme: 'dark' } };
export const OverlayLight = { args: { theme: 'light', overlay: true } };
export const OverlayDark = { args: { theme: 'dark', overlay: true } };
export const System = {};
