import type { Meta, StoryObj } from '@storybook/svelte-vite';
import type { Thread } from '../fixtures/demo.js';
import ThreadView from './ThreadView.svelte';

const thread: Thread = {
  id: 'thread-grove-export',
  subject: 'Question about monthly export access',
  project: 'Grove',
  supporter: 'Maya Chen',
  amountMinor: 1800,
  amountLabel: '£18.00',
  cadence: 'monthly',
  relativeTime: '2 hours ago',
  preview: 'Could you confirm where monthly exports are available?',
  status: 'open',
  messages: [
    {
      id: 'message-1',
      author: 'Maya Chen',
      body: 'Could you confirm where monthly exports are available? I can see the dashboard totals.',
      timestamp: 'Today, 09:14',
      relativeTime: '2 hours ago',
    },
    {
      id: 'message-2',
      author: 'oss.tips team',
      body: 'Exports are under Project settings. We will keep this thread open while you check it.',
      timestamp: 'Today, 09:32',
      relativeTime: '2 hours ago',
      internal: true,
    },
  ],
};

const meta = {
  title: 'Components/ThreadView',
  component: ThreadView,
} satisfies Meta<typeof ThreadView>;

export default meta;
type Story = StoryObj<typeof meta>;

const successfulAction = async (_input: { threadId: string; body?: string; reason?: string }) => ({
  ok: true as const,
});
const failedAction = async (_input: { threadId: string; body?: string; reason?: string }) => ({
  ok: false as const,
  message: 'Moderation service is unavailable.',
});

export const Default: Story = { args: { thread } };
export const Loading: Story = { args: { thread, loading: true } };
export const Disabled: Story = { args: { thread, disabled: true } };
export const ErrorState: Story = {
  args: { thread, error: 'Reply could not be sent. Check connection and try again.' },
};
export const Compact: Story = {
  args: { thread },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { args: { thread }, globals: { theme: 'dark' } };
export const ModerationControls: Story = {
  args: { thread, actor: 'supporter', onBlock: successfulAction, onReport: successfulAction },
};
export const Blocked: Story = {
  args: {
    thread,
    actor: 'guest',
    blocked: true,
    onBlock: successfulAction,
    onReport: successfulAction,
  },
};
export const Reported: Story = {
  args: {
    thread,
    actor: 'project',
    reported: true,
    onBlock: successfulAction,
    onReport: successfulAction,
  },
};
export const ActionError: Story = {
  args: { thread, onBlock: failedAction, onReport: failedAction },
};
