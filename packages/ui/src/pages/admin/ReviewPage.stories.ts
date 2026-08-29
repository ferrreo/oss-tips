import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ReviewPage from './ReviewPage.svelte';

const meta: Meta<ReviewPage> = {
  title: 'Pages/Admin/Review',
  component: ReviewPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
