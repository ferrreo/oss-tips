import type { Meta, StoryObj } from '@storybook/svelte-vite';
import FeeDisclosure from './FeeDisclosure.svelte';

const meta: Meta<FeeDisclosure> = {
  title: 'Components/FeeDisclosure',
  component: FeeDisclosure,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { projectAmountMinor: 2500, tipMinor: 100, cadence: "monthly" } };
export const Dark: Story = { args: { projectAmountMinor: 2500, tipMinor: 100, cadence: "monthly" }, globals: { theme: 'dark' } };
