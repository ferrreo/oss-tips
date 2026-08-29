import { demoTiers } from '../fixtures/demo.js';
import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupportComposer from './SupportComposer.svelte';

const meta: Meta<SupportComposer> = {
  title: 'Components/SupportComposer',
  component: SupportComposer,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    tiers: demoTiers,
    currency: 'GBP',
    projectFeePercent: 5,
  },
};

export const Dark: Story = {
  args: {
    tiers: demoTiers,
    currency: 'GBP',
    projectFeePercent: 5,
  },
  globals: { theme: 'dark' },
};
