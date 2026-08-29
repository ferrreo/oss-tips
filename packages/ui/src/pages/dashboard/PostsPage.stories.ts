import type { Meta, StoryObj } from '@storybook/svelte-vite';
import PostsPage from './PostsPage.svelte';

const meta: Meta<PostsPage> = {
  title: 'Pages/Dashboard/Posts',
  component: PostsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
