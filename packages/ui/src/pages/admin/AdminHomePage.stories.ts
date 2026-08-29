import type { Meta, StoryObj } from '@storybook/svelte';
import AdminHomePage from './AdminHomePage.svelte';

const meta: Meta<AdminHomePage> = {
  title: 'Pages/Admin/Home',
  component: AdminHomePage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
