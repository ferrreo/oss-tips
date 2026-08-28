import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectPostEditorPage from './ProjectPostEditorPage.svelte';

const meta: Meta<ProjectPostEditorPage> = {
  title: 'Pages/ProjectDashboard/Post Editor',
  component: ProjectPostEditorPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
