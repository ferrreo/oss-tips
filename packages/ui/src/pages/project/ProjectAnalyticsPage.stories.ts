import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectAnalyticsPage from './ProjectAnalyticsPage.svelte';

const meta: Meta<ProjectAnalyticsPage> = {
  title: 'Pages/ProjectDashboard/Analytics',
  component: ProjectAnalyticsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
