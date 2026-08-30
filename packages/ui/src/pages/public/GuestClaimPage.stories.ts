import type { Meta, StoryObj } from '@storybook/svelte-vite';
import GuestClaimPage from './GuestClaimPage.svelte';
import { demoProject } from '../../fixtures/demo.js';

const realisticData = {
  project: demoProject,
  amountMinor: 5000,
  cadence: 'one-off',
  reference: 'oss_01J8GROVE',
  expires: '5 Sep 2026',
  email: 'guest@example.com',
  status: 'idle' as const,
};
const meta = {
  title: 'Pages/Public/Guest Claim',
  component: GuestClaimPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GuestClaimPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const EmptyInput: Story = { args: { ...realisticData, email: '', status: 'idle' } };
export const Sent: Story = { args: { ...realisticData, status: 'sent' } };
export const Error: Story = { args: { ...realisticData, email: '', status: 'error' } };
export const Claimed: Story = { args: { ...realisticData, status: 'claimed' } };
export const Expired: Story = {
  args: { ...realisticData, status: 'expired', accessState: 'expired' },
};
export const Used: Story = { args: { ...realisticData, status: 'used', accessState: 'used' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const French: Story = { globals: { locale: 'fr' } };
export const LongCopy: Story = {
  args: {
    ...realisticData,
    reference: 'oss_01J8GROVE_SUPPORT_RECEIPT_REFERENCE',
    expires: '27 September 2026',
  },
};
export const RtlLongCopy: Story = { globals: { locale: 'pt-BR', direction: 'rtl' } };
