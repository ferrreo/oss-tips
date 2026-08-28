import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectGoalsPage from './ProjectGoalsPage.svelte';

const meta: Meta<ProjectGoalsPage> = {
  title: 'Pages/ProjectDashboard/Goals',
  component: ProjectGoalsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
