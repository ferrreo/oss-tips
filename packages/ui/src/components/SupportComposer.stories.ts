import { demoTiers } from '../fixtures/demo.js';
import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupportComposer from './SupportComposer.svelte';

const noopContinue = () => undefined;
const initialTier = demoTiers[1];
if (!initialTier) throw new Error('Expected a second demo tier');

const meta = {
  title: 'Components/SupportComposer',
  component: SupportComposer,
  args: { oncontinue: noopContinue },
} satisfies Meta<typeof SupportComposer>;

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

export const Loading: Story = {
  args: {
    tiers: demoTiers,
    currency: 'GBP',
    projectFeePercent: 5,
    loading: true,
  },
};

export const Disabled: Story = {
  args: {
    tiers: demoTiers,
    currency: 'GBP',
    projectFeePercent: 5,
    disabled: true,
  },
};

export const ErrorState: Story = {
  args: {
    tiers: demoTiers,
    currency: 'GBP',
    projectFeePercent: 5,
    error: 'Checkout is unavailable while payment settings are being checked.',
  },
};

export const Compact: Story = {
  args: {
    tiers: demoTiers,
    currency: 'GBP',
    projectFeePercent: 5,
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const InitialSelection: Story = {
  args: {
    tiers: demoTiers,
    currency: 'GBP',
    initialCadence: 'annual',
    initialAmountMinor: initialTier.annualMinor,
    selectedTierId: initialTier.id,
    initialTipMinor: 200,
  },
};

export const PublicRecognition: Story = {
  args: {
    tiers: demoTiers,
    currency: 'GBP',
    initialDisplayName: 'Ada Lovelace',
    initialMessage: 'Thank you for maintaining this project.',
    initialReceiptEmail: 'ada@example.com',
    initialShowName: true,
    initialShowAmount: true,
    initialShowMessage: true,
  },
};
export const JapaneseYen: Story = {
  args: {
    tiers: demoTiers,
    currency: 'JPY',
    minAmountMinor: 500,
    maxAmountMinor: 50000,
    initialAmountMinor: 1000,
  },
};
