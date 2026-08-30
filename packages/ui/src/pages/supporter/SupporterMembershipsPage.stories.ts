import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupporterMembershipsPage from './SupporterMembershipsPage.svelte';
import { platformTipMinor, supporterMemberships } from './supporter-demo.js';

const realisticData = {
  memberships: supporterMemberships,
  platformTipMinor,
  platformTipMembershipId: supporterMemberships[0]?.id ?? null,
  onmanagebilling: async () => undefined,
  oncancel: async () => undefined,
  onupdatetip: async () => undefined,
};

const mixedCurrencyData = {
  ...realisticData,
  memberships: supporterMemberships.map((membership) =>
    membership.id === 'mem6' ? { ...membership, amountMinor: 1200, currency: 'USD' } : membership,
  ),
};

const meta = {
  title: 'Pages/Supporter/Memberships',
  component: SupporterMembershipsPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SupporterMembershipsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Populated: Story = Default;
export const Empty: Story = { args: { ...realisticData, memberships: [] } };
export const Error: Story = {
  args: { ...realisticData, error: 'Membership data is unavailable. Try again in a moment.' },
};
export const MixedCurrencies: Story = { args: mixedCurrencyData };
export const BillingLoading: Story = {
  args: { ...realisticData, portalState: 'loading', portalProjectSlug: 'grove' },
};
export const BillingSuccess: Story = {
  args: { ...realisticData, portalState: 'success', portalProjectSlug: 'grove' },
};
export const BillingError: Story = {
  args: {
    ...realisticData,
    portalState: 'error',
    portalProjectSlug: 'grove',
    portalError: 'Stripe billing is temporarily unavailable. Try again in a moment.',
  },
};
export const CancelLoading: Story = {
  args: {
    ...realisticData,
    cancelState: 'loading',
    cancelMembershipId: supporterMemberships[0]?.id ?? 'membership_1',
  },
};
export const CancelSuccess: Story = { args: { ...realisticData, cancelState: 'success' } };
export const CancelError: Story = {
  args: {
    ...realisticData,
    cancelState: 'error',
    cancelError: 'Membership could not be cancelled. Try again.',
  },
};
export const TipLoading: Story = {
  args: {
    ...realisticData,
    tipState: 'loading',
    tipMembershipId: supporterMemberships[0]?.id ?? '',
  },
};
export const TipIdle: Story = { args: { ...realisticData, tipState: 'idle' } };
export const TipSuccess: Story = { args: { ...realisticData, tipState: 'success' } };
export const TipError: Story = {
  args: {
    ...realisticData,
    tipState: 'error',
    tipError: 'Platform tip could not be updated. Try again.',
  },
};
export const TipAnnual: Story = {
  args: {
    ...realisticData,
    platformTipMembershipId:
      supporterMemberships.find((membership) => membership.cadence === 'annual')?.id ?? null,
  },
};
export const TipZero: Story = { args: { ...realisticData, platformTipMinor: 0 } };
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { globals: { theme: 'dark' } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
