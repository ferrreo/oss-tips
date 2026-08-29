import type { Meta, StoryObj } from '@storybook/svelte';
import DirectoryPage from './DirectoryPage.svelte';

const meta: Meta<DirectoryPage> = {
  title: 'Pages/Admin/Directory Alias',
  component: DirectoryPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
