import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectSupportersPage from './ProjectSupportersPage.svelte';

const meta: Meta<ProjectSupportersPage> = {
  title: 'Pages/ProjectDashboard/Supporters',
  component: ProjectSupportersPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
