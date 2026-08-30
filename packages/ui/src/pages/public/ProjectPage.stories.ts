import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectPage from './ProjectPage.svelte';
import {
  demoGoals,
  demoPosts,
  demoProject,
  demoSupporters,
  demoTiers,
  formatMoney,
} from '../../fixtures/demo.js';

const noopContinue = () => undefined;

const goal = demoGoals.find((item) => item.slug === 'infrastructure-upgrade');
if (!goal) throw new Error('Grove demo goal infrastructure-upgrade is missing');
const publicPosts = demoPosts.filter((item) => item.tierVisibility === 'Public');
const gatedPost = demoPosts.find((item) => item.tierVisibility !== 'Public');
if (!gatedPost) throw new Error('Grove demo gated post is missing');
const gatedPostSummary = { ...gatedPost, excerpt: '', body: '' };
const realisticData = {
  project: demoProject,
  tiers: demoTiers,
  goal,
  supporters: demoSupporters,
  posts: publicPosts,
  community: [
    { label: 'Discord', href: 'https://discord.gg/grove' },
    { label: 'Docs', href: 'https://grove.dev/docs' },
    { label: 'Mastodon', href: 'https://fosstodon.org/@grove' },
  ],
  stats: [
    {
      label: 'Active supporters',
      value: String(demoProject.stats.supporters),
      compare: 'Public count',
      sparkline: [210, 228, 241, 255, 268, 284],
    },
    {
      label: 'Monthly recurring',
      value: formatMoney(demoProject.stats.monthlyRecurringMinor, demoProject.currency),
      compare: 'Settled, before fees',
      sparkline: [4100, 4550, 5020, 5480, 6010, 6421],
    },
    {
      label: 'One-off this month',
      value: formatMoney(demoProject.stats.oneOffThisMonthMinor, demoProject.currency),
      compare: 'Settled this month',
      sparkline: [1800, 2400, 3100, 4200, 5100, 6420],
    },
  ],
  embed: '<script async src="https://oss.tips/widgets/grove/thanks.js"><\/script>',
  initialTier: 'supporter',
  oncontinue: noopContinue,
};
const meta = {
  title: 'Pages/Public/Project',
  component: ProjectPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProjectPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const EmptyCommunity: Story = { args: { ...realisticData, supporters: [], posts: [] } };
export const NoMemberships: Story = { args: { ...realisticData, tiers: [] } };
export const GatedMetadataOnly: Story = {
  args: {
    ...realisticData,
    project: { ...demoProject, showGatedPostMetadata: true },
    posts: [...publicPosts, gatedPostSummary],
  },
};
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
export const German: Story = {
  globals: { locale: 'de' },
};
export const LongCopy: Story = {
  args: {
    ...realisticData,
    project: {
      ...demoProject,
      description: `${demoProject.description} This longer project description checks wrapping beside the hero, support controls, and community links.`,
    },
  },
};
export const RtlLongCopy: Story = {
  globals: { locale: 'fr', direction: 'rtl' },
};
