import PostSummaryCanvas from '../../../.storybook/PostSummaryCanvas.astro';

export default {
  title: 'Marketing/PostSummary',
  component: PostSummaryCanvas,
  args: { theme: 'light', variant: 'published' },
};

export const PublishedLight = { args: { variant: 'published', theme: 'light' } };
export const PublishedDark = { args: { variant: 'published', theme: 'dark' } };
export const DraftLight = { args: { variant: 'draft', theme: 'light' } };
export const DraftDark = { args: { variant: 'draft', theme: 'dark' } };
export const ScheduledLight = { args: { variant: 'scheduled', theme: 'light' } };
export const ScheduledDark = { args: { variant: 'scheduled', theme: 'dark' } };
export const NoAuthorUrlLight = { args: { variant: 'no-author-url', theme: 'light' } };
export const NoAuthorUrlDark = { args: { variant: 'no-author-url', theme: 'dark' } };
export const LongTitleLight = { args: { variant: 'long-title', theme: 'light' } };
export const LongTitleDark = { args: { variant: 'long-title', theme: 'dark' } };
export const NoDateLight = { args: { variant: 'no-date', theme: 'light' } };
export const NoDateDark = { args: { variant: 'no-date', theme: 'dark' } };
