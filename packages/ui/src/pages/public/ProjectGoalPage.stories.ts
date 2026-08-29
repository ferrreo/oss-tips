import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectGoalPage from './ProjectGoalPage.svelte';

const meta: Meta<ProjectGoalPage> = {
  title: 'Pages/Public/Project Goal',
  component: ProjectGoalPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
