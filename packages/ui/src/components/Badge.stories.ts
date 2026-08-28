import type { Meta, StoryObj } from '@storybook/svelte';
import Badge from './Badge.svelte';

const meta: Meta<Badge> = {
  title: 'Components/Badge',
  component: Badge,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { variant: "forest" } };
export const Dark: Story = { args: { variant: "forest" }, globals: { theme: 'dark' } };
