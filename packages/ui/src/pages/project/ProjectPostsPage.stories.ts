import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectPostsPage from './ProjectPostsPage.svelte';

const meta: Meta<ProjectPostsPage> = {
  title: 'Pages/ProjectDashboard/Posts',
  component: ProjectPostsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
