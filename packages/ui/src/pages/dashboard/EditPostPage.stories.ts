import type { Meta, StoryObj } from '@storybook/svelte';
import EditPostPage from './EditPostPage.svelte';

const meta: Meta<EditPostPage> = {
  title: 'Pages/Dashboard/EditPost',
  component: EditPostPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
