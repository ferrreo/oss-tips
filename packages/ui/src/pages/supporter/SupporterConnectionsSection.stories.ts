import type { Meta, StoryObj } from '@storybook/svelte-vite';
import StoryMainContext from '../../../.storybook/StoryMainContext.svelte';
import { supporterLinkedAccounts, supporterOAuthProviders } from './supporter-demo.js';
import SupporterConnectionsSection from './SupporterConnectionsSection.svelte';

const runSecurityAction = async (
  _key: string,
  action: (() => void | Promise<void>) | undefined,
) => {
  await action?.();
};

const meta = {
  title: 'Pages/Supporter/Connections section',
  component: SupporterConnectionsSection,
  args: {
    linkedAccounts: supporterLinkedAccounts,
    oauthProviders: supporterOAuthProviders,
    onlinkaccount: async () => undefined,
    onunlinkaccount: async () => undefined,
    runSecurityAction,
  },
  parameters: { layout: 'padded' },
  decorators: [() => ({ Component: StoryMainContext })],
} satisfies Meta<typeof SupporterConnectionsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoProviders: Story = {
  args: { linkedAccounts: [], oauthProviders: [] },
};
export const Loading: Story = { args: { securityState: 'loading' } };
export const Error: Story = {
  args: {
    securityState: 'error',
    securityError: 'Connections could not be loaded. Try again in a moment.',
  },
};
export const Linking: Story = { args: { securityAction: 'provider:google' } };
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { globals: { theme: 'dark' } };
