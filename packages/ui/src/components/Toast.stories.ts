import type { Meta, StoryObj } from '@storybook/svelte-vite';
import Toast from './Toast.svelte';

const meta = {
  title: 'Components/Toast',
  component: Toast,
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { message: 'Settings saved', variant: 'success' } };
export const Error: Story = {
  args: { message: 'Could not save payout settings. Try again.', variant: 'error' },
};
export const Compact: Story = {
  args: { message: 'Profile updated', variant: 'default' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = {
  args: { message: 'Settings saved', variant: 'success' },
  globals: { theme: 'dark' },
};
