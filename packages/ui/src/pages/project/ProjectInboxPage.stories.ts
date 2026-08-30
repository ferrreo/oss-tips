import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectInboxPage from './ProjectInboxPage.svelte';
import { inboxThreads } from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Inbox',
  component: ProjectInboxPage,
  parameters: { layout: 'fullscreen' },
  args: { threads: inboxThreads },
} satisfies Meta<typeof ProjectInboxPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { threads: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
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
