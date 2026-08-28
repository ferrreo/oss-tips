import type { Meta, StoryObj } from '@storybook/svelte';
import ProjectSupportPage from './ProjectSupportPage.svelte';

const meta: Meta<ProjectSupportPage> = {
  title: 'Pages/Public/Project Support',
  component: ProjectSupportPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
