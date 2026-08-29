import type { Meta, StoryObj } from '@storybook/svelte';
import ProgressBar from './ProgressBar.svelte';

const meta: Meta<ProgressBar> = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { value: 62, label: "Goal progress" } };
export const Dark: Story = { args: { value: 62, label: "Goal progress" }, globals: { theme: 'dark' } };
