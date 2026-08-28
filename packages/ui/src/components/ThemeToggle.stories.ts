import type { Meta, StoryObj } from '@storybook/svelte';
import ThemeToggle from './ThemeToggle.svelte';

const meta: Meta<ThemeToggle> = {
  title: 'Components/ThemeToggle',
  component: ThemeToggle,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
export const Dark: Story = { args: {}, globals: { theme: 'dark' } };
