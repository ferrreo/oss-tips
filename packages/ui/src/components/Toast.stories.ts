import type { Meta, StoryObj } from '@storybook/svelte-vite';
import Toast from './Toast.svelte';

const meta: Meta<Toast> = {
  title: 'Components/Toast',
  component: Toast,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { message: "Settings saved", variant: "success" } };
export const Dark: Story = { args: { message: "Settings saved", variant: "success" }, globals: { theme: 'dark' } };
