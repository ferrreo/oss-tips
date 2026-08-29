import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectPaymentsPage from './ProjectPaymentsPage.svelte';

const meta: Meta<ProjectPaymentsPage> = {
  title: 'Pages/ProjectDashboard/Payments',
  component: ProjectPaymentsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
