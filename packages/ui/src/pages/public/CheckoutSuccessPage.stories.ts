import type { Meta, StoryObj } from '@storybook/svelte-vite';
import CheckoutSuccessPage from './CheckoutSuccessPage.svelte';
import { demoProject } from '../../fixtures/demo.js';

const realisticData = {
  project: demoProject,
  amountMinor: 2500,
  tipMinor: 100,
  cadence: 'monthly',
  tier: 'Supporter',
  entitlement: 'Supporter rewards for 30 days',
  expires: '27 Sep 2026',
  reference: 'cs_test_grove_supporter_01',
  receiptEmail: 'ada@example.com',
  paymentStatus: 'confirmed' as const,
};
const meta = {
  title: 'Pages/Public/Checkout Success',
  component: CheckoutSuccessPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CheckoutSuccessPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Processing: Story = { args: { ...realisticData, paymentStatus: 'processing' } };
export const Failed: Story = { args: { ...realisticData, paymentStatus: 'failed' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const German: Story = { globals: { locale: 'de' } };
export const LongCopy: Story = {
  args: {
    ...realisticData,
    entitlement:
      'Supporter access with a longer entitlement description that remains clear when translated and wrapped across several lines.',
  },
};
export const RtlLongCopy: Story = {
  globals: { locale: 'fr', direction: 'rtl' },
};
