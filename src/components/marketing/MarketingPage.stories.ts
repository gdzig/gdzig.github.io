import MarketingPageCanvas from '../../../.storybook/MarketingPageCanvas.astro';

export default {
  title: 'Marketing/MarketingPage',
  component: MarketingPageCanvas,
  args: { kind: 'page-composition', background: 'fade', article: false, empty: false, theme: 'light', panelPadding: 1.5, panelOverlap: 1.5 },
  argTypes: {
    background: { control: 'select', options: ['fade', 'pattern'] },
    article: { control: 'boolean' },
    empty: { control: 'boolean' },
    title: { control: 'text' },
    panelPadding: { control: { type: 'range', min: 0.5, max: 3, step: 0.25 }, description: 'Panel side chrome in rem. The reading measure remains capped at 65ch.' },
    panelOverlap: { control: { type: 'range', min: 0.5, max: 2.5, step: 0.25 }, description: 'How far the panel bridges the introduction, in rem.' },
  },
};

export const FadeLight = {};
export const FadeDark = { args: { theme: 'dark' } };
export const PatternLight = { args: { background: 'pattern' } };
export const PatternDark = { args: { background: 'pattern', theme: 'dark' } };
export const ArticleFadeLight = { args: { article: true } };
export const ArticleFadeDark = { args: { article: true, theme: 'dark' } };
export const ArticlePatternLight = { args: { article: true, background: 'pattern' } };
export const ArticlePatternDark = { args: { article: true, background: 'pattern', theme: 'dark' } };
export const EmptyFade = { args: { empty: true } };
export const EmptyPattern = { args: { empty: true, background: 'pattern' } };
export const LongArticleTitle = { args: { article: true, title: 'Article typography specimen with an intentionally long FIXTURE_TITLE that wraps onto multiple lines' } };
export const RoomyPanel = { args: { article: true, panelPadding: 3, panelOverlap: 2 } };
export const CompactPanel = { args: { article: true, panelPadding: 0.75, panelOverlap: 0.75 } };
