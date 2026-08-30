import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProgressBar from './ProgressBar.svelte';

const meta = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { value: 62, label: 'Goal progress' } };
export const Complete: Story = { args: { value: 100, label: 'Goal progress' } };
export const Clamped: Story = { args: { value: 128, max: 100, label: 'Goal progress' } };
export const Compact: Story = {
  args: { value: 62, label: 'Goal progress' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = {
  args: { value: 62, label: 'Goal progress' },
  globals: { theme: 'dark' },
};
