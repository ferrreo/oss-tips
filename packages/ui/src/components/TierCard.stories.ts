import { demoTiers } from "../fixtures/demo.js";
import type { Meta, StoryObj } from '@storybook/svelte';
import TierCard from './TierCard.svelte';

const meta: Meta<TierCard> = {
  title: 'Components/TierCard',
  component: TierCard,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { tier: demoTiers[1], currency: "GBP" } };
export const Dark: Story = { args: { tier: demoTiers[1], currency: "GBP" }, globals: { theme: 'dark' } };
