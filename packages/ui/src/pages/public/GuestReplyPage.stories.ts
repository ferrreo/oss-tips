import type { Meta, StoryObj } from '@storybook/svelte-vite';
import GuestReplyPage from './GuestReplyPage.svelte';
import { demoProject, demoThreads } from '../../fixtures/demo.js';

const thread = demoThreads.find((item) => item.id === 't2');
if (!thread) throw new Error('Grove demo thread t2 is missing');
const realisticData = { project: demoProject, thread, reply: '', status: 'idle' as const };
const meta = {
  title: 'Pages/Public/Guest Reply',
  component: GuestReplyPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GuestReplyPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Sent: Story = {
  args: {
    ...realisticData,
    reply: 'Thanks for the update. I will check the next release.',
    status: 'sent',
  },
};
export const LoadError: Story = { args: { ...realisticData, status: 'error' } };
export const Expired: Story = {
  args: { ...realisticData, status: 'expired', accessState: 'expired' },
};
export const Used: Story = { args: { ...realisticData, status: 'used', accessState: 'used' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const Blocked: Story = {
  args: {
    ...realisticData,
    blocked: true,
    onBlockThread: async () => ({ ok: true as const }),
    onReportThread: async () => ({ ok: true as const }),
  },
};
export const Reported: Story = {
  args: {
    ...realisticData,
    reported: true,
    onBlockThread: async () => ({ ok: true as const }),
    onReportThread: async () => ({ ok: true as const }),
  },
};
export const ModerationError: Story = {
  args: {
    ...realisticData,
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
export const French: Story = { globals: { locale: 'fr' } };
export const LongCopy: Story = {
  args: {
    ...realisticData,
    reply:
      'Thanks for keeping the project moving. This longer guest reply checks readable wrapping, useful focus order, and clear feedback before the next release.',
  },
};
export const RtlLongCopy: Story = { globals: { locale: 'es', direction: 'rtl' } };
