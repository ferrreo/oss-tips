import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectSettingsPage from './ProjectSettingsPage.svelte';

const meta: Meta<ProjectSettingsPage> = {
  title: 'Pages/ProjectDashboard/Settings',
  component: ProjectSettingsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
