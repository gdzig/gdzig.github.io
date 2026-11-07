import GuestPostNoticeCanvas from '../../../.storybook/GuestPostNoticeCanvas.astro';

export default {
  title: 'Marketing/GuestPostNotice',
  component: GuestPostNoticeCanvas,
  args: {
    authorName: 'Fixture author',
    authorUrl: 'https://example.invalid/FIXTURE-author',
    theme: 'light',
  },
  argTypes: {
    authorName: { control: 'text', description: 'Guest author display name.' },
    authorUrl: { control: 'text', description: 'Optional author profile URL. Leave empty for unlinked credit.' },
    contributor: { control: 'boolean', description: 'Include contributor credit only when confirmed. Defaults to false.' },
    theme: { control: 'select', options: ['light', 'dark'] },
  },
};

export const CommunityMemberLight = {};
export const CommunityMemberDark = { args: { theme: 'dark' } };
export const ContributorLight = { args: { contributor: true } };
export const ContributorDark = { args: { contributor: true, theme: 'dark' } };
export const NoProfileLight = { args: { authorUrl: '', contributor: true } };
export const NoProfileDark = { args: { authorUrl: '', contributor: true, theme: 'dark' } };
export const LongNameLight = { args: { authorName: 'FIXTURE_LONG_NAME_'.repeat(12) } };
export const LongNameDark = { args: { authorName: 'FIXTURE_LONG_NAME_'.repeat(12), theme: 'dark' } };
