import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminReviewQueuePage from './AdminReviewQueuePage.svelte';

const meta: Meta<AdminReviewQueuePage> = {
  title: 'Pages/Admin/Review Queue',
  component: AdminReviewQueuePage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
