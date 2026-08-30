import type { Meta, StoryObj } from '@storybook/svelte-vite';
import StoryMainContext from '../../../.storybook/StoryMainContext.svelte';
import { supporterSessions } from './supporter-demo.js';
import SupporterSessionsSection from './SupporterSessionsSection.svelte';

const runSecurityAction = async (
  _key: string,
  action: (() => void | Promise<void>) | undefined,
) => {
  await action?.();
};

const meta = {
  title: 'Pages/Supporter/Sessions section',
  component: SupporterSessionsSection,
  args: {
    sessions: supporterSessions,
    onrevokesession: async () => undefined,
    onrevokeothersessions: async () => undefined,
    runSecurityAction,
  },
  parameters: { layout: 'padded' },
  decorators: [() => ({ Component: StoryMainContext })],
} satisfies Meta<typeof SupporterSessionsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { sessions: [] } };
export const Loading: Story = { args: { securityState: 'loading' } };
export const Error: Story = {
  args: {
    securityState: 'error',
    securityError: 'Sessions could not be loaded. Try again in a moment.',
  },
};
export const Revoking: Story = { args: { securityAction: 'session:session-phone' } };
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { globals: { theme: 'dark' } };
