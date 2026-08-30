import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupporterSettingsPage from './SupporterSettingsPage.svelte';
import {
  supporterEmail,
  supporterLinkedAccounts,
  supporterName,
  supporterOAuthProviders,
  supporterPasskeys,
  supporterSessions,
} from './supporter-demo.js';

const realisticData = {
  supporterName,
  supporterEmail,
  initialTheme: 'system' as const,
  initialWallName: 'public' as const,
  initialWallAmount: 'hidden' as const,
  passkeys: supporterPasskeys,
  sessions: supporterSessions,
  linkedAccounts: supporterLinkedAccounts,
  oauthProviders: supporterOAuthProviders,
  onsave: async () => undefined,
  onaddpasskey: async () => undefined,
  onremovepasskey: async () => undefined,
  onrevokesession: async () => undefined,
  onrevokeothersessions: async () => undefined,
  onlinkaccount: async () => undefined,
  onunlinkaccount: async () => undefined,
  onexportdata: async () => undefined,
  ondeleteaccount: async () => undefined,
};

const meta = {
  title: 'Pages/Supporter/Settings',
  component: SupporterSettingsPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SupporterSettingsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Populated: Story = Default;
export const AnonymousWall: Story = {
  args: { ...realisticData, initialWallName: 'anonymous', initialWallAmount: 'shown' },
};
export const Error: Story = {
  args: {
    ...realisticData,
    error: 'Settings could not be saved. Check your connection and try again.',
  },
};
export const SecurityEmpty: Story = {
  args: {
    ...realisticData,
    passkeys: [],
    sessions: [],
    linkedAccounts: [],
  },
};
export const SecurityLoading: Story = {
  args: {
    ...realisticData,
    securityState: 'loading',
  },
};
export const SecurityError: Story = {
  args: {
    ...realisticData,
    securityState: 'error',
    securityError: 'Security settings could not be loaded. Try again in a moment.',
  },
};
export const OAuthUnavailable: Story = {
  args: {
    ...realisticData,
    oauthProviders: [],
    linkedAccounts: [],
  },
};
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { globals: { theme: 'dark' } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
