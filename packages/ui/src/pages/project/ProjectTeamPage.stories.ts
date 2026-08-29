import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectTeamPage from './ProjectTeamPage.svelte';

const meta: Meta<ProjectTeamPage> = {
  title: 'Pages/ProjectDashboard/Team',
  component: ProjectTeamPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
