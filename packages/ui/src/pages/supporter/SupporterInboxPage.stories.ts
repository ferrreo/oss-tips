import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupporterInboxPage from './SupporterInboxPage.svelte';
import { supporterThreads } from './supporter-demo.js';

const realisticData = { threads: supporterThreads };

const meta = {
  title: 'Pages/Supporter/Inbox',
  component: SupporterInboxPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SupporterInboxPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Populated: Story = Default;
export const Empty: Story = { args: { threads: [] } };
export const Error: Story = {
  args: { ...realisticData, error: 'Messages are unavailable. Try again in a moment.' },
};
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Blocked: Story = {
  args: {
    blocked: true,
    onBlockThread: async () => ({ ok: true as const }),
    onReportThread: async () => ({ ok: true as const }),
  },
};
export const Reported: Story = {
  args: {
    reported: true,
    onBlockThread: async () => ({ ok: true as const }),
    onReportThread: async () => ({ ok: true as const }),
  },
};
export const ModerationError: Story = {
  args: {
    onBlockThread: async () => ({
      ok: false as const,
      message: 'Moderation service is unavailable.',
    }),
    onReportThread: async () => ({
      ok: false as const,
      message: 'Moderation service is unavailable.',
    }),
  },
};
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
