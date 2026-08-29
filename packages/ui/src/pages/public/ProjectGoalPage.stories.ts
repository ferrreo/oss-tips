import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectGoalPage from './ProjectGoalPage.svelte';

const meta: Meta<ProjectGoalPage> = {
  title: 'Pages/Public/Project Goal',
  component: ProjectGoalPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { slug: 'infrastructure-upgrade' },
};
export const GroveInfrastructure: Story = {
  args: { slug: 'infrastructure-upgrade' },
};
export const GroveDocumentation: Story = {
  args: { slug: 'documentation-overhaul' },
};
export const Dark: Story = {
  args: { slug: 'infrastructure-upgrade' },
  globals: { theme: 'dark' },
};
