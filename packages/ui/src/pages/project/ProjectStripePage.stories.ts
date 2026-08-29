import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectStripePage from './ProjectStripePage.svelte';

const meta: Meta<ProjectStripePage> = {
  title: 'Pages/ProjectDashboard/Stripe',
  component: ProjectStripePage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
