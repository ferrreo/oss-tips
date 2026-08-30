import type { Meta, StoryObj } from '@storybook/svelte-vite';
import PricingPage from './PricingPage.svelte';

const realisticData = {
  lead: 'You see the project amount, the oss.tips fee, and any tip before Stripe Checkout opens.',
  modes: [
    {
      heading: 'Standard mode',
      body: 'The project pays a platform fee on each transaction. Supporters may add an optional tip to oss.tips.',
    },
    {
      heading: 'Project 5% mode',
      body: 'Some projects absorb the platform fee. The breakdown still appears before checkout.',
    },
  ],
  columns: [
    { key: 'item', label: 'Shown before checkout' },
    { key: 'standard', label: 'Standard' },
    { key: 'absorbed', label: 'Project 5%' },
  ],
  rows: [
    { item: 'Project receives', standard: '$10.00', absorbed: '$10.00' },
    { item: 'oss.tips project fee', standard: '$0.50 (5%)', absorbed: '$0.00 to supporter' },
    { item: 'Optional tip', standard: '$0.00 to any', absorbed: '$0.00 to any' },
    { item: 'Stripe processing', standard: 'At checkout', absorbed: 'At checkout' },
  ],
  exampleAmountMinor: 2500,
  exampleTipMinor: 100,
  currency: 'USD',
};
const meta = {
  title: 'Pages/Public/Pricing',
  component: PricingPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PricingPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: realisticData };
export const NoTip: Story = { args: { ...realisticData, exampleTipMinor: 0 } };
export const Compact: Story = {
  args: realisticData,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { args: realisticData, globals: { theme: 'dark' } };
export const German: Story = { globals: { locale: 'de' } };
export const LongCopy: Story = {
  args: {
    ...realisticData,
    lead: 'See every project amount, platform fee, optional tip, and payment-processing detail before Stripe Checkout opens, with enough room for a translated explanation.',
  },
};
export const RtlLongCopy: Story = {
  args: realisticData,
  globals: { locale: 'fr', direction: 'rtl' },
};
