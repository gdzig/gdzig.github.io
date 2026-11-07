import MarketingPageCanvas from '../../../.storybook/MarketingPageCanvas.astro';

export default {
  title: 'Marketing/PageIntro',
  component: MarketingPageCanvas,
  args: { kind: 'page-composition', theme: 'light' },
};

export const PageLight = {};
export const PageDark = { args: { theme: 'dark' } };
export const ArticleLight = { args: { article: true } };
export const ArticleDark = { args: { article: true, theme: 'dark' } };
export const LongArticle = { args: { article: true, title: 'Article typography specimen with an intentionally long FIXTURE_TITLE' } };
