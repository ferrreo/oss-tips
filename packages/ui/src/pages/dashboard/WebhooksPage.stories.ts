import type { Meta, StoryObj } from '@storybook/svelte';
import WebhooksPage from './WebhooksPage.svelte';

const meta: Meta<WebhooksPage> = {
  title: 'Pages/Dashboard/Webhooks',
  component: WebhooksPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
