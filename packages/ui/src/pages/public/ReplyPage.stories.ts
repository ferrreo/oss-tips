import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ReplyPage from './ReplyPage.svelte';

const meta: Meta<ReplyPage> = {
  title: 'Pages/Public/Reply',
  component: ReplyPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
