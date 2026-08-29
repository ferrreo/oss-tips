import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupporterInboxPage from './SupporterInboxPage.svelte';

const meta: Meta<SupporterInboxPage> = {
  title: 'Pages/Supporter/Inbox',
  component: SupporterInboxPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
