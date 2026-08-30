import type { Meta, StoryObj } from '@storybook/svelte-vite';
import EmptyState from './EmptyState.svelte';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'No payments yet',
    description: 'When supporters pay, they appear here.',
    actionLabel: 'Share project page',
  },
};
export const NoAction: Story = {
  args: {
    title: 'No saved searches',
    description: 'Save a search to keep an eye on projects you care about.',
  },
};
export const Compact: Story = {
  args: { title: 'No supporters in this view', description: 'Try widening your date range.' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = {
  args: {
    title: 'No payments yet',
    description: 'When supporters pay, they appear here.',
    actionLabel: 'Share project page',
  },
  globals: { theme: 'dark' },
};
