import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectInboxPage from './ProjectInboxPage.svelte';

const meta: Meta<ProjectInboxPage> = {
  title: 'Pages/ProjectDashboard/Inbox',
  component: ProjectInboxPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
