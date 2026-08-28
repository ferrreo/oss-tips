import type { Meta, StoryObj } from '@storybook/svelte';
import AdminCasesPage from './AdminCasesPage.svelte';

const meta: Meta<AdminCasesPage> = {
  title: 'Pages/Admin/Cases',
  component: AdminCasesPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
