import AuthorNoticeCanvas from '../../../.storybook/AuthorNoticeCanvas.astro';

export default {
  title: 'Marketing/AuthorNotice',
  component: AuthorNoticeCanvas,
  args: {
    authorName: 'Fixture author',
    authorUrl: 'https://example.invalid/FIXTURE-author',
    theme: 'light',
  },
  argTypes: {
    authorName: { control: 'text', description: 'Author display name.' },
    authorUrl: { control: 'text', description: 'Optional author profile URL. Leave empty for unlinked credit.' },
    guest: { control: 'boolean', description: 'Describe this as a guest post only when explicitly selected. Defaults to false.' },
    roles: { control: 'check', options: ['community member', 'contributor', 'maintainer', 'founder'], description: 'Confirmed GDZig roles only. Defaults to no affiliation.' },
    sourceUrl: { control: 'text', description: 'Optional original source URL, matching the postamble.' },
    sourcePublishedAt: { control: 'text', description: 'Optional original publication date as YYYY-MM-DD. Requires a source URL.' },
    theme: { control: 'select', options: ['light', 'dark'] },
  },
};

const communityGuest = { guest: true, roles: ['community member'] };
const contributorGuest = { guest: true, roles: ['community member', 'contributor'] };
const originalSource = { sourceUrl: 'https://example.invalid/original/' };
const datedSource = { ...originalSource, sourcePublishedAt: '1999-01-01' };

export const CommunityMemberLight = { args: communityGuest };
export const CommunityMemberDark = { args: { ...communityGuest, theme: 'dark' } };
export const ContributorLight = { args: contributorGuest };
export const ContributorDark = { args: { ...contributorGuest, theme: 'dark' } };
export const MaintainerLight = { args: { roles: ['maintainer'] } };
export const MaintainerDark = { args: { roles: ['maintainer'], theme: 'dark' } };
export const FounderLight = { args: { roles: ['founder'] } };
export const FounderDark = { args: { roles: ['founder'], theme: 'dark' } };
export const FounderMaintainerLight = { args: { roles: ['founder', 'maintainer'] } };
export const FounderMaintainerDark = { args: { roles: ['founder', 'maintainer'], theme: 'dark' } };
export const GuestMaintainerLight = { args: { guest: true, roles: ['maintainer'] } };
export const GuestMaintainerDark = { args: { guest: true, roles: ['maintainer'], theme: 'dark' } };
export const AllRolesLight = { args: { roles: ['community member', 'contributor', 'maintainer', 'founder'] } };
export const AllRolesDark = { args: { roles: ['community member', 'contributor', 'maintainer', 'founder'], theme: 'dark' } };
export const NoRolesLight = {};
export const NoRolesDark = { args: { theme: 'dark' } };
export const NoProfileLight = { args: { ...contributorGuest, authorUrl: '' } };
export const NoProfileDark = { args: { ...contributorGuest, authorUrl: '', theme: 'dark' } };
export const LongNameLight = { args: { ...communityGuest, authorName: 'FIXTURE_LONG_NAME_'.repeat(12) } };
export const LongNameDark = { args: { ...communityGuest, authorName: 'FIXTURE_LONG_NAME_'.repeat(12), theme: 'dark' } };
export const SourceOnlyLight = { args: { ...communityGuest, ...originalSource } };
export const SourceOnlyDark = { args: { ...communityGuest, ...originalSource, theme: 'dark' } };
export const SourceDatedLight = { args: { ...communityGuest, ...datedSource } };
export const SourceDatedDark = { args: { ...communityGuest, ...datedSource, theme: 'dark' } };
export const TeamSourceLight = { args: { roles: ['founder', 'maintainer'], ...datedSource } };
export const TeamSourceDark = { args: { roles: ['founder', 'maintainer'], ...datedSource, theme: 'dark' } };
export const LongSourceLight = { args: { ...communityGuest, sourceUrl: `https://example.invalid/${'FIXTURE_ORIGINAL_SOURCE_'.repeat(16)}/` } };
export const LongSourceDark = { args: { ...LongSourceLight.args, theme: 'dark' } };
