import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectSupportPage from './ProjectSupportPage.svelte';
import { demoProject, demoTiers } from '../../fixtures/demo.js';

const noopContinue = () => undefined;

const realisticData = {
  project: demoProject,
  tiers: demoTiers,
  lead: 'Pick a cadence and amount, then continue to Stripe. Access is granted only after Stripe confirms the payment.',
  oncontinue: noopContinue,
};
const meta = {
  title: 'Pages/Public/Project Support',
  component: ProjectSupportPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProjectSupportPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const OneOffOnly: Story = { args: { ...realisticData, tiers: [] } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const CheckoutLoading: Story = { args: { ...realisticData, checkoutLoading: true } };
export const CheckoutUnavailable: Story = {
  args: {
    ...realisticData,
    checkoutError: 'Checkout is unavailable while payment settings are being checked.',
  },
};
export const CheckoutDisabled: Story = { args: { ...realisticData, checkoutDisabled: true } };
export const PublicRecognition: Story = {
  args: {
    ...realisticData,
    initialDisplayName: 'Ada Lovelace',
    initialMessage: 'Thank you for keeping this project useful.',
    initialReceiptEmail: 'ada@example.com',
    initialShowName: true,
    initialShowAmount: true,
    initialShowMessage: true,
  },
};
export const German: Story = {
  globals: { locale: 'de' },
};
export const LongCopy: Story = {
  args: {
    ...realisticData,
    lead: 'Choose a cadence and amount, review the complete fee disclosure, and continue to Stripe once the project and payment state are clear.',
  },
};
export const RtlLongCopy: Story = {
  globals: { locale: 'fr', direction: 'rtl' },
};
