import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminDirectoryPage from './AdminDirectoryPage.svelte';

const meta: Meta<AdminDirectoryPage> = {
  title: 'Pages/Admin/Directory',
  component: AdminDirectoryPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
