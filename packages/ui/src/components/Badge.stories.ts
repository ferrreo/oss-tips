import type { Meta, StoryObj } from '@storybook/svelte-vite';
import Badge from './Badge.svelte';

const meta: Meta<Badge> = {
  title: 'Components/Badge',
  component: Badge,
  args: { label: 'Verified' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Forest: Story = { args: { variant: 'forest', label: 'Verified' } };
export const Ochre: Story = { args: { variant: 'ochre', label: 'Most popular' } };
export const Danger: Story = { args: { variant: 'danger', label: 'Failed job' } };
export const Dark: Story = { args: { variant: 'forest', label: 'Verified' }, globals: { theme: 'dark' } };
