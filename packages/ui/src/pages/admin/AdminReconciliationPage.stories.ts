import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminReconciliationPage from './AdminReconciliationPage.svelte';

const meta: Meta<AdminReconciliationPage> = {
  title: 'Pages/Admin/Reconciliation',
  component: AdminReconciliationPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
