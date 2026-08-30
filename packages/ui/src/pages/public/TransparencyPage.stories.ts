import type { Meta, StoryObj } from '@storybook/svelte-vite';
import TransparencyPage from './TransparencyPage.svelte';

type DemoCard = {
  label: string;
  value: string;
  compare: string;
  compareDirection: 'up' | 'down' | 'neutral';
  sparkline: number[];
};

type DemoData = {
  lead: string;
  cards: DemoCard[];
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
  state: 'ready' | 'empty' | 'error';
};

const realisticData: DemoData = {
  lead: 'These figures use settled Stripe data only. Pending payments and browser redirects are excluded.',
  cards: [
    {
      label: 'Projects published',
      value: '1,248',
      compare: '+12 this month',
      compareDirection: 'up' as const,
      sparkline: [980, 1040, 1112, 1180, 1220, 1248],
    },
    {
      label: 'Support processed (30d)',
      value: '$2.4M',
      compare: 'Settled volume',
      compareDirection: 'neutral' as const,
      sparkline: [18, 19, 21, 20, 23, 24],
    },
    {
      label: 'Median project fee',
      value: '5.0%',
      compare: 'Standard mode',
      compareDirection: 'neutral' as const,
      sparkline: [5, 5, 5, 5, 5, 5],
    },
    {
      label: 'Guest one-off share',
      value: '38%',
      compare: 'Of settled one-offs',
      compareDirection: 'neutral' as const,
      sparkline: [34, 35, 36, 37, 37, 38],
    },
  ],
  columns: [
    { key: 'rule', label: 'Rule' },
    { key: 'detail', label: 'How we apply it' },
  ],
  rows: [
    {
      rule: 'Settlement only',
      detail: 'Figures update after Stripe settlement, not authorisation.',
    },
    { rule: 'No vanity rank', detail: 'We do not publish payment-volume leaderboards.' },
    {
      rule: 'Tips excluded',
      detail: 'Supporter tips to oss.tips are not counted as project support.',
    },
  ],
  state: 'ready',
};
const meta = {
  title: 'Pages/Public/Transparency',
  component: TransparencyPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TransparencyPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: realisticData };
export const LiveAggregate: Story = {
  args: {
    aggregate: {
      publishedProjects: 1248,
      settledSupport: [{ currency: 'USD', amountMinor: '240000000' }],
      medianProjectFeePercent: 5,
      guestOneOffSharePercent: 38,
      refundedSupport: [{ currency: 'USD', percent: 0.4 }],
      activeMemberships: 6412,
    },
  },
};
export const Empty: Story = { args: { ...realisticData, cards: [], rows: [], state: 'empty' } };
export const Error: Story = { args: { ...realisticData, state: 'error' } };
export const Compact: Story = {
  args: realisticData,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { args: realisticData, globals: { theme: 'dark' } };
export const French: Story = {
  args: {
    ...realisticData,
    lead: 'Ces chiffres utilisent uniquement les données Stripe réglées. Les paiements en attente et les redirections du navigateur sont exclus.',
    cards: [
      { ...realisticData.cards[0]!, label: 'Projets publiés', compare: '+12 ce mois-ci' },
      { ...realisticData.cards[1]!, label: 'Soutien traité (30 j)', compare: 'Volume réglé' },
      { ...realisticData.cards[2]!, label: 'Frais médians par projet', compare: 'Mode standard' },
      {
        ...realisticData.cards[3]!,
        label: 'Part des paiements uniques invités',
        compare: 'Paiements uniques réglés',
      },
    ],
    columns: [
      { key: 'rule', label: 'Règle' },
      { key: 'detail', label: 'Application' },
    ],
    rows: [
      {
        rule: 'Règlement uniquement',
        detail: 'Les chiffres sont mis à jour après le règlement Stripe, pas après l’autorisation.',
      },
      {
        rule: 'Pas de classement flatteur',
        detail: 'Nous ne publions pas de classement selon le volume des paiements.',
      },
      {
        rule: 'Pourboires exclus',
        detail: 'Les pourboires versés à oss.tips ne comptent pas comme soutien au projet.',
      },
    ],
  },
  globals: { locale: 'fr' },
};
export const LongCopy: Story = {
  args: {
    ...realisticData,
    lead: 'These settled Stripe figures stay transparent and deliberately plain, so anyone can understand what has cleared and what is still outside the report.',
  },
};
export const RtlLongCopy: Story = {
  args: {
    ...realisticData,
    lead: 'Estes números usam somente dados liquidados da Stripe. Pagamentos pendentes e redirecionamentos do navegador são excluídos.',
  },
  globals: { locale: 'pt-BR', direction: 'rtl' },
};
