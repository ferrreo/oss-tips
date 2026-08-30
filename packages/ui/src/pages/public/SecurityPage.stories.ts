import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SecurityPage from './SecurityPage.svelte';

const realisticData = {
  lead: 'Card numbers never hit oss.tips. Stripe takes payments. Admin actions are logged and cannot be edited quietly.',
  groups: [
    {
      heading: 'Payments',
      items: [
        'Stripe stores card details. We do not.',
        'Each project is the merchant on Stripe Connect.',
        'Every Stripe webhook is signature-checked.',
      ],
    },
    {
      heading: 'Sign-in',
      items: [
        'Email codes or OAuth. No passwords on oss.tips.',
        'Sessions can be listed and revoked.',
      ],
    },
    {
      heading: 'Operations',
      items: [
        'Privileged admin steps write an audit entry.',
        'API keys are scoped and hashed at rest.',
      ],
    },
  ],
  report:
    'Use Report on any project page. Staff see the report next to that project in the review queue.',
};
const meta = {
  title: 'Pages/Public/Security',
  component: SecurityPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SecurityPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: realisticData };
export const Compact: Story = {
  args: realisticData,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { args: realisticData, globals: { theme: 'dark' } };
export const German: Story = { globals: { locale: 'de' } };
export const LongCopy: Story = {
  args: {
    ...realisticData,
    lead: 'Card numbers never reach oss.tips, payment confirmation stays server-side, and every privileged action leaves an audit trail that operators can review later.',
  },
};
export const RtlLongCopy: Story = {
  args: realisticData,
  globals: { locale: 'es', direction: 'rtl' },
};
