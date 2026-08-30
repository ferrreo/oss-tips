import type { Meta, StoryObj } from '@storybook/svelte-vite';
import StoryMainContext from '../../../.storybook/StoryMainContext.svelte';
import { supporterPasskeys } from './supporter-demo.js';
import SupporterPasskeysSection from './SupporterPasskeysSection.svelte';

const runSecurityAction = async (
  _key: string,
  action: (() => void | Promise<void>) | undefined,
) => {
  await action?.();
};

const meta = {
  title: 'Pages/Supporter/Passkeys section',
  component: SupporterPasskeysSection,
  args: {
    passkeys: supporterPasskeys,
    onaddpasskey: async () => undefined,
    onremovepasskey: async () => undefined,
    runSecurityAction,
  },
  parameters: { layout: 'padded' },
  decorators: [() => ({ Component: StoryMainContext })],
} satisfies Meta<typeof SupporterPasskeysSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { passkeys: [] } };
export const Loading: Story = { args: { securityState: 'loading' } };
export const Error: Story = {
  args: {
    securityState: 'error',
    securityError: 'Passkeys could not be loaded. Try again in a moment.',
  },
};
export const Removing: Story = { args: { securityAction: 'passkey:passkey-macbook' } };
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { globals: { theme: 'dark' } };
