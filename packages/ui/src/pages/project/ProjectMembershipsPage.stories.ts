import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectMembershipsPage from './ProjectMembershipsPage.svelte';

const meta: Meta<ProjectMembershipsPage> = {
  title: 'Pages/ProjectDashboard/Memberships',
  component: ProjectMembershipsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
