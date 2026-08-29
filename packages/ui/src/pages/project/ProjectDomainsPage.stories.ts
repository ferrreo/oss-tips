import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectDomainsPage from './ProjectDomainsPage.svelte';

const meta: Meta<ProjectDomainsPage> = {
  title: 'Pages/ProjectDashboard/Domains',
  component: ProjectDomainsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
