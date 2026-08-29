import type { Meta, StoryObj } from '@storybook/svelte';
import AmountSelector from './AmountSelector.svelte';

const meta: Meta<AmountSelector> = {
  title: 'Components/AmountSelector',
  component: AmountSelector,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
export const Dark: Story = { args: {}, globals: { theme: 'dark' } };
