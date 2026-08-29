import type { Meta, StoryObj } from '@storybook/svelte-vite';
import GuestReplyPage from './GuestReplyPage.svelte';

const meta: Meta<GuestReplyPage> = {
  title: 'Pages/Public/Guest Reply',
  component: GuestReplyPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
