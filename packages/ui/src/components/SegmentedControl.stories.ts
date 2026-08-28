import type { Meta, StoryObj } from '@storybook/svelte';
import SegmentedControl from './SegmentedControl.svelte';

const meta: Meta<SegmentedControl> = {
  title: 'Components/SegmentedControl',
  component: SegmentedControl,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { options: [{ value: "a", label: "One" }, { value: "b", label: "Two" }], value: "a" } };
export const Dark: Story = { args: { options: [{ value: "a", label: "One" }, { value: "b", label: "Two" }], value: "a" }, globals: { theme: 'dark' } };
