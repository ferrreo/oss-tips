import { demoTiers } from '../fixtures/demo.js';
import type { Meta, StoryObj } from '@storybook/svelte-vite';
import TierCard from './TierCard.svelte';

const meta = {
  title: 'Components/TierCard',
  component: TierCard,
} satisfies Meta<typeof TierCard>;

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
const championYear = { ...champion, oneOffDuration: 'year' as const };

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

export const OneOffDuration: Story = {
  args: { tier: supporter, currency: 'GBP', cadence: 'one-off', selected: true },
};
export const CapAndYearDuration: Story = {
  args: { tier: championYear, currency: 'GBP', cadence: 'one-off', selected: true },
};

export const Disabled: Story = {
  args: { tier: coffee, currency: 'GBP', cadence: 'monthly', disabled: true },
};

export const Loading: Story = {
  args: { tier: coffee, currency: 'GBP', cadence: 'monthly', loading: true },
};

export const ErrorState: Story = {
  args: {
    tier: supporter,
    currency: 'GBP',
    cadence: 'monthly',
    error: 'This tier is temporarily unavailable.',
  },
};

export const Compact: Story = {
  args: { tier: coffee, currency: 'GBP', cadence: 'monthly', selected: true },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const Dark: Story = {
  args: { tier: coffee, currency: 'GBP', cadence: 'monthly', selected: true },
  globals: { theme: 'dark' },
};
