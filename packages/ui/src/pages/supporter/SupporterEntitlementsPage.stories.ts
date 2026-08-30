import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupporterEntitlementsPage from './SupporterEntitlementsPage.svelte';
import { supporterEntitlements } from './supporter-demo.js';

const realisticData = {
  entitlements: supporterEntitlements,
  currentDate: '2026-08-29',
};

const meta = {
  title: 'Pages/Supporter/Entitlements',
  component: SupporterEntitlementsPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SupporterEntitlementsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Populated: Story = Default;
export const Empty: Story = { args: { ...realisticData, entitlements: [] } };
export const Error: Story = {
  args: { ...realisticData, error: 'Entitlements are unavailable. Try again in a moment.' },
};
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { globals: { theme: 'dark' } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
