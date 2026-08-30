import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminReviewQueuePage from './AdminReviewQueuePage.svelte';
import { adminNav, reviewQueue } from './admin-demo.js';

const populatedArgs = {
  navGroups: adminNav('/admin/review'),
  reviewItems: reviewQueue,
  initialSelectedId: 'rev_1047',
};

const meta = {
  title: 'Pages/Admin/Review Queue',
  component: AdminReviewQueuePage,
  parameters: { layout: 'fullscreen' },
  render: (args) => ({ Component: AdminReviewQueuePage, props: args }),
} satisfies Meta<typeof AdminReviewQueuePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = { args: populatedArgs };
export const HighRisk: Story = { args: { ...populatedArgs, initialFilter: 'high' } };
export const Empty: Story = { args: { ...populatedArgs, reviewItems: [], state: 'empty' } };
export const Error: Story = { args: { ...populatedArgs, state: 'error' } };
export const Forbidden: Story = { args: { ...populatedArgs, state: 'forbidden' } };
export const Compact: Story = {
  args: populatedArgs,
  parameters: { layout: 'fullscreen', viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { args: populatedArgs, globals: { theme: 'dark' } };
export const German: Story = { args: populatedArgs, globals: { locale: 'de' } };
export const RtlSmoke: Story = { args: populatedArgs, globals: { locale: 'fr', direction: 'rtl' } };
