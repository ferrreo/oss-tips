import type { Meta, StoryObj } from '@storybook/svelte-vite';
import Button from './Button.svelte';

const meta: Meta<Button> = {
  title: 'Components/Button',
  component: Button,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
export const Dark: Story = { args: {}, globals: { theme: 'dark' } };
