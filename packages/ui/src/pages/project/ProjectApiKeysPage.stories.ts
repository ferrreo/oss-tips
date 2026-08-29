import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectApiKeysPage from './ProjectApiKeysPage.svelte';

const meta: Meta<ProjectApiKeysPage> = {
  title: 'Pages/ProjectDashboard/API Keys',
  component: ProjectApiKeysPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
