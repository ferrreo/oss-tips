import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectOverviewPage from './ProjectOverviewPage.svelte';

const meta: Meta<ProjectOverviewPage> = {
  title: 'Pages/ProjectDashboard/Overview',
  component: ProjectOverviewPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
