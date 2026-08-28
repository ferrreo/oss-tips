import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectPostPage from './ProjectPostPage.svelte';

const meta: Meta<ProjectPostPage> = {
  title: 'Pages/Public/Project Post',
  component: ProjectPostPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
