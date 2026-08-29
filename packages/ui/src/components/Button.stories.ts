import type { Meta, StoryObj } from '@storybook/svelte-vite';
import Button from './Button.svelte';

const meta: Meta<Button> = {
  title: 'Components/Button',
  component: Button,
  args: { label: 'Save changes' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: 'secondary', label: 'Cancel' } };
export const Quiet: Story = { args: { variant: 'quiet', label: 'Skip for now' } };
export const Destructive: Story = { args: { variant: 'destructive', label: 'Refund payment' } };
export const Loading: Story = { args: { loading: true, label: 'Save changes' } };
export const Dark: Story = { globals: { theme: 'dark' } };
