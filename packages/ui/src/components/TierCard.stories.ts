import { demoTiers } from '../fixtures/demo.js';
import type { Meta, StoryObj } from '@storybook/svelte-vite';
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

const coffee = demoTier('coffee');
const supporter = demoTier('supporter');
const champion = demoTier('champion');

export const Default: Story = {
  args: { tier: coffee, currency: 'GBP', cadence: 'monthly', selected: false },
};

export const Selected: Story = {
  args: { tier: coffee, currency: 'GBP', cadence: 'monthly', selected: true },
};

export const Popular: Story = {
  args: { tier: supporter, currency: 'GBP', cadence: 'monthly', selected: false },
};

export const Annual: Story = {
  args: { tier: champion, currency: 'GBP', cadence: 'annual' },
};

export const Dark: Story = {
  args: { tier: coffee, currency: 'GBP', cadence: 'monthly', selected: true },
  globals: { theme: 'dark' },
};
