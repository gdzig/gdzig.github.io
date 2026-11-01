import MarketingCanvas from '../../../.storybook/MarketingCanvas.astro';

export default {
  title: 'Marketing/ActionLink',
  component: MarketingCanvas,
  args: { kind: 'action', href: '#fixture-action', label: 'FIXTURE_ACTION', variant: 'primary' },
};

export const PrimaryLight = { args: { theme: 'light' } };
export const PrimaryDark = { args: { theme: 'dark' } };
export const OutlineLight = { args: { theme: 'light', variant: 'outline' } };
export const OutlineDark = { args: { theme: 'dark', variant: 'outline' } };
export const LongLabelLight = { args: { theme: 'light', label: 'FIXTURE_LONG_ACTION_LABEL FOR RESPONSIVE PREVIEW' } };
export const LongLabelDark = { args: { theme: 'dark', label: 'FIXTURE_LONG_ACTION_LABEL FOR RESPONSIVE PREVIEW' } };
