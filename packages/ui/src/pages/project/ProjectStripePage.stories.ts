import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectStripePage from './ProjectStripePage.svelte';
import { stripeCapabilityRows } from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Stripe',
  component: ProjectStripePage,
  parameters: { layout: 'fullscreen' },
  args: {
    capabilities: stripeCapabilityRows,
    stripeAccountId: 'acct_oss_tips_demo',
    chargesEnabled: true,
    payoutsEnabled: false,
  },
} satisfies Meta<typeof ProjectStripePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { capabilities: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const ActionLoading: Story = { args: { onboardingState: 'loading' } };
export const ActionSuccess: Story = { args: { onboardingState: 'success' } };
export const ActionError: Story = {
  args: {
    onboardingState: 'error',
    onboardingError: 'Stripe could not start verification. Try again in a moment.',
  },
};
/** No key is supplied in stories, so Connect.js never makes a network call. */
export const EmbeddedFallback: Story = {
  args: { stripePublishableKey: '', accountSessionEndpoint: '' },
};
export const EmbeddedReady: Story = { args: { connectPreviewState: 'ready' } };
export const EmbeddedDark: Story = {
  args: { connectPreviewState: 'ready' },
  globals: { theme: 'dark' },
};
export const EmbeddedLoading: Story = { args: { connectPreviewState: 'loading' } };
export const EmbeddedError: Story = {
  args: {
    connectPreviewState: 'error',
    connectPreviewError: 'Stripe account tools are temporarily unavailable.',
  },
};
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
