import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupporterHomePage from './SupporterHomePage.svelte';
import {
  lifetimeSupport,
  supporterEntitlements,
  supporterMemberships,
  supporterName,
  supporterThreads,
} from './supporter-demo.js';

const realisticData = {
  supporterName,
  memberships: supporterMemberships,
  entitlements: supporterEntitlements,
  threads: supporterThreads,
  lifetimeSupport,
  currentDate: '2026-08-29',
};

const mixedCurrencyData = {
  ...realisticData,
  memberships: supporterMemberships.map((membership) =>
    membership.id === 'mem6' ? { ...membership, amountMinor: 1200, currency: 'USD' } : membership,
  ),
  lifetimeSupport: lifetimeSupport.map((row) =>
    row.projectName === 'paper-ink'
      ? { ...row, oneOffMinor: 2000, recurringMinor: 6000, currency: 'USD' }
      : row,
  ),
};

const meta = {
  title: 'Pages/Supporter/Home',
  component: SupporterHomePage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SupporterHomePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Populated: Story = Default;
export const Empty: Story = {
  args: {
    ...realisticData,
    memberships: [],
    entitlements: [],
    threads: [],
    lifetimeSupport: [],
  },
};
export const Error: Story = {
  args: { ...realisticData, error: 'Supporter data is unavailable. Try again in a moment.' },
};
export const MixedCurrencies: Story = { args: mixedCurrencyData };
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { globals: { theme: 'dark' } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
