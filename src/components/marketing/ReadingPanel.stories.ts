import MarketingPageCanvas from '../../../.storybook/MarketingPageCanvas.astro';

export default {
  title: 'Marketing/ReadingPanel',
  component: MarketingPageCanvas,
  args: { kind: 'page-composition', article: true, theme: 'light', panelPadding: 1.5, panelOverlap: 1.5 },
};

export const DefaultLight = {};
export const DefaultDark = { args: { theme: 'dark' } };
export const PatternLight = { args: { background: 'pattern' } };
export const PatternDark = { args: { background: 'pattern', theme: 'dark' } };
export const Roomy = { args: { panelPadding: 3, panelOverlap: 2 } };
export const Compact = { args: { panelPadding: 0.75, panelOverlap: 0.75 } };
