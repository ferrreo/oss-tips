import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminOverviewPage from './AdminOverviewPage.svelte';

const meta: Meta<AdminOverviewPage> = {
  title: 'Pages/Admin/Overview',
  component: AdminOverviewPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
