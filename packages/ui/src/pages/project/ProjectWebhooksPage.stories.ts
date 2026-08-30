import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectWebhooksPage from './ProjectWebhooksPage.svelte';
import { webhookDeliveries, webhookRows } from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Webhooks',
  component: ProjectWebhooksPage,
  parameters: { layout: 'fullscreen' },
  args: {
    endpoints: webhookRows,
    deliveries: webhookDeliveries,
    onCreateEndpoint: async () => 'whsec_storybook_2f3a1c9e',
  },
} satisfies Meta<typeof ProjectWebhooksPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { endpoints: [], deliveries: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
