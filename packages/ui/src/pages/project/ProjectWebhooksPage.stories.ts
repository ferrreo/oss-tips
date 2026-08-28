import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectWebhooksPage from './ProjectWebhooksPage.svelte';

const meta: Meta<ProjectWebhooksPage> = {
  title: 'Pages/ProjectDashboard/Webhooks',
  component: ProjectWebhooksPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
