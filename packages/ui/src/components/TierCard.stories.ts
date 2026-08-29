import { demoTiers } from '../fixtures/demo.js';
import type { Meta, StoryObj } from '@storybook/svelte';
import TierCard from './TierCard.svelte';

const meta: Meta<TierCard> = {
  title: 'Components/TierCard',
  component: TierCard,
};

export default meta;
type Story = StoryObj<typeof meta>;

function demoTier(id: string) {
  const found = demoTiers.find((tier) => tier.id === id);
  if (!found) throw new Error(`demoTiers is missing ${id}`);
  return found;
}

const sapling = demoTier('sapling');
const canopy = demoTier('canopy');

export const Default: Story = {
  args: { tier: sapling, currency: 'GBP', cadence: 'monthly', selected: false },
};

export const Selected: Story = {
  args: { tier: sapling, currency: 'GBP', cadence: 'monthly', selected: true },
};

export const Annual: Story = {
  args: { tier: canopy, currency: 'GBP', cadence: 'annual' },
};

export const Dark: Story = {
  args: { tier: sapling, currency: 'GBP', cadence: 'monthly', selected: true },
  globals: { theme: 'dark' },
};
