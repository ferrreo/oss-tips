import type { Meta, StoryObj } from '@storybook/svelte';
import EmptyState from './EmptyState.svelte';

const meta: Meta<EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { title: "No payments yet", description: "When supporters pay, they appear here.", actionLabel: "Share project page" } };
export const Dark: Story = { args: { title: "No payments yet", description: "When supporters pay, they appear here.", actionLabel: "Share project page" }, globals: { theme: 'dark' } };
