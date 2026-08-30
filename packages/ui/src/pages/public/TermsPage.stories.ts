import type { Meta, StoryObj } from '@storybook/svelte-vite';
import TermsPage from './TermsPage.svelte';

const realisticData = {
  updated: 'Last updated August 2026',
  sections: [
    {
      heading: '1. The service',
      body: 'oss.tips provides infrastructure for open-source projects to receive support. Projects are independent merchants.',
    },
    {
      heading: '2. Accounts',
      body: 'Supporters may use guest checkout for one-off support. Accounts are required for subscriptions and replies.',
    },
    {
      heading: '3. Fees',
      body: 'All fees are disclosed before payment confirmation. Platform tips are optional and editable to zero.',
    },
    {
      heading: '4. Refunds',
      body: 'Refund policy is set by each project subject to Stripe and card network rules.',
    },
  ],
  docs: [
    { href: '/terms/privacy', label: 'Privacy policy' },
    { href: '/terms/acceptable-use', label: 'Acceptable use' },
    { href: '/terms/refunds', label: 'Refunds and disputes' },
    { href: '/terms/cookies', label: 'Cookie policy' },
  ],
};
const meta = {
  title: 'Pages/Public/Terms',
  component: TermsPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TermsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const French: Story = {
  globals: { locale: 'fr' },
};
export const LongCopy: Story = {
  args: {
    ...realisticData,
    sections: realisticData.sections.map((section) => ({
      ...section,
      body: `${section.body} This longer example keeps legal context readable at narrow widths and at increased text size.`,
    })),
  },
};
export const RtlLongCopy: Story = {
  globals: { locale: 'es', direction: 'rtl' },
};
