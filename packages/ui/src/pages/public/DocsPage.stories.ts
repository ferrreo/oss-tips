import type { Meta, StoryObj } from '@storybook/svelte-vite';
import DocsPage from './DocsPage.svelte';

const realisticData = {
  nav: [
    { href: '#getting-started', label: 'Getting started' },
    { href: '#projects', label: 'Projects' },
    { href: '#supporters', label: 'Supporters' },
    { href: '#api', label: 'API' },
  ],
  sections: [
    {
      id: 'getting-started',
      heading: 'Getting started',
      body: 'Create a project, connect Stripe, add membership tiers, then publish.',
    },
    {
      id: 'projects',
      heading: 'For project owners',
      body: 'Use the dashboard for payments, posts, goals, Discord roles, and team access.',
    },
    {
      id: 'supporters',
      heading: 'For supporters',
      body: 'Sign in with an email code or OAuth to manage memberships and replies.',
    },
    {
      id: 'api',
      heading: 'API and webhooks',
      body: 'Checkout sessions are created on the server. Outgoing webhooks are signed.',
    },
  ],
  endpoints: [
    { method: 'POST', path: '/v1/checkout/sessions', note: 'Start Checkout' },
    { method: 'GET', path: '/v1/projects/:slug', note: 'Public project' },
    { method: 'POST', path: '/v1/webhooks/stripe', note: 'Stripe events in' },
  ],
  events: 'payment.succeeded · membership.updated · entitlement.revoked',
};
const meta = {
  title: 'Pages/Public/Docs',
  component: DocsPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DocsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: realisticData };
export const Compact: Story = {
  args: realisticData,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { args: realisticData, globals: { theme: 'dark' } };
export const German: Story = {
  globals: { locale: 'de' },
};
export const LongCopy: Story = {
  args: {
    ...realisticData,
    sections: realisticData.sections.map((section) => ({
      ...section,
      body: `${section.body} The longer version keeps operational details visible without relying on hover or hidden context.`,
    })),
  },
};
export const RtlLongCopy: Story = {
  globals: { locale: 'fr', direction: 'rtl' },
};
