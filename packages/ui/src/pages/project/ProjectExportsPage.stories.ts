import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectExportsPage from './ProjectExportsPage.svelte';

const meta: Meta<ProjectExportsPage> = {
  title: 'Pages/ProjectDashboard/Exports',
  component: ProjectExportsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
