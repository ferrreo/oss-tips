import type { Meta, StoryObj } from '@storybook/svelte-vite';
import Badge from './Badge.svelte';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: { label: 'Verified' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Forest: Story = { args: { variant: 'forest', label: 'Verified' } };
export const Ochre: Story = { args: { variant: 'ochre', label: 'Most popular' } };
export const Danger: Story = { args: { variant: 'danger', label: 'Failed job' } };
export const Dark: Story = {
  args: { variant: 'forest', label: 'Verified' },
  globals: { theme: 'dark' },
};
export const Compact: Story = {
  args: { variant: 'ochre', label: '3 unread' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
