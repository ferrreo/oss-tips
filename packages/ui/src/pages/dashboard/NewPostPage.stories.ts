import type { Meta, StoryObj } from '@storybook/svelte-vite';
import NewPostPage from './NewPostPage.svelte';

const meta: Meta<NewPostPage> = {
  title: 'Pages/Dashboard/NewPost',
  component: NewPostPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
