import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectPage from './ProjectPage.svelte';

const meta: Meta<ProjectPage> = {
  title: 'Pages/Public/Project',
  component: ProjectPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
