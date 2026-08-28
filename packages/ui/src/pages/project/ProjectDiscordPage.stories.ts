import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectDiscordPage from './ProjectDiscordPage.svelte';

const meta: Meta<ProjectDiscordPage> = {
  title: 'Pages/ProjectDashboard/Discord',
  component: ProjectDiscordPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
