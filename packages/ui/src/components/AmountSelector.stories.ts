import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AmountSelector from './AmountSelector.svelte';

const meta = {
  title: 'Components/AmountSelector',
  component: AmountSelector,
} satisfies Meta<typeof AmountSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { currency: 'GBP', cadence: 'one-off', selectedAmountMinor: 1000 },
};
export const CustomAmount: Story = {
  args: { currency: 'GBP', cadence: 'monthly', selectedAmountMinor: 1800 },
};
export const Embedded: Story = {
  args: { currency: 'GBP', embedded: true, selectedAmountMinor: 1000 },
};
export const Loading: Story = { args: { loading: true, selectedAmountMinor: 2500 } };
export const Disabled: Story = { args: { disabled: true, selectedAmountMinor: 2500 } };
export const ErrorState: Story = {
  args: { error: 'Choose an amount of at least £2.00.', selectedAmountMinor: 100 },
};
export const Compact: Story = {
  args: { currency: 'GBP', presets: [200, 500, 1000, 2500] },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = {
  args: { currency: 'GBP', cadence: 'monthly', selectedAmountMinor: 2500 },
  globals: { theme: 'dark' },
};
export const JapaneseYen: Story = {
  args: {
    currency: 'JPY',
    cadence: 'one-off',
    presets: [500, 1000, 2500, 5000],
    minAmountMinor: 500,
    maxAmountMinor: 50000,
    selectedAmountMinor: 1000,
  },
};
