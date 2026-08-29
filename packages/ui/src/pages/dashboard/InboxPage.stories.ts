import type { Meta, StoryObj } from '@storybook/svelte-vite';
import InboxPage from './InboxPage.svelte';

const meta: Meta<InboxPage> = {
  title: 'Pages/Dashboard/Inbox',
  component: InboxPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
