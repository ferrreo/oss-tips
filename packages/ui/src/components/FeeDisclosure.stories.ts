import type { Meta, StoryObj } from '@storybook/svelte-vite';
import FeeDisclosure from './FeeDisclosure.svelte';

const meta = {
  title: 'Components/FeeDisclosure',
  component: FeeDisclosure,
} satisfies Meta<typeof FeeDisclosure>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { projectAmountMinor: 2500, tipMinor: 100, cadence: 'monthly' },
};
export const NoPlatformTip: Story = {
  args: { projectAmountMinor: 1200, tipMinor: 0, cadence: 'one-off' },
};
export const Compact: Story = {
  args: { projectAmountMinor: 2500, tipMinor: 100, cadence: 'monthly' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const SectionHeading: Story = {
  args: { projectAmountMinor: 2500, tipMinor: 100, cadence: 'monthly', headingLevel: 2 },
};
export const Dark: Story = {
  args: { projectAmountMinor: 2500, tipMinor: 100, cadence: 'monthly' },
  globals: { theme: 'dark' },
};
