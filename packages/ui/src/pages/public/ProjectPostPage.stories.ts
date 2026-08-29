import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectPostPage from './ProjectPostPage.svelte';

const meta: Meta<ProjectPostPage> = {
  title: 'Pages/Public/Project Post',
  component: ProjectPostPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { slug: 'infrastructure-goal-update' },
};
export const GroveInfrastructure: Story = {
  args: { slug: 'infrastructure-goal-update' },
};
export const GroveRelease: Story = {
  args: { slug: 'grove-1-0' },
};
export const Dark: Story = {
  args: { slug: 'infrastructure-goal-update' },
  globals: { theme: 'dark' },
};
