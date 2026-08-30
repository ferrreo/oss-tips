import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminReconciliationPage from './AdminReconciliationPage.svelte';
import { adminNav, reconciliationRows } from './admin-demo.js';

const populatedArgs = {
  navGroups: adminNav('/admin/reconciliation'),
  rows: reconciliationRows,
};

const meta = {
  title: 'Pages/Admin/Reconciliation',
  component: AdminReconciliationPage,
  parameters: { layout: 'fullscreen' },
  render: (args) => ({ Component: AdminReconciliationPage, props: args }),
} satisfies Meta<typeof AdminReconciliationPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = { args: populatedArgs };
export const Aligned: Story = {
  args: { ...populatedArgs, rows: reconciliationRows.filter((row) => row.status === 'aligned') },
};
export const Empty: Story = { args: { ...populatedArgs, rows: [], state: 'empty' } };
export const Error: Story = { args: { ...populatedArgs, state: 'error' } };
export const Forbidden: Story = { args: { ...populatedArgs, state: 'forbidden' } };
export const Compact: Story = {
  args: populatedArgs,
  parameters: { layout: 'fullscreen', viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { args: populatedArgs, globals: { theme: 'dark' } };
export const German: Story = { args: populatedArgs, globals: { locale: 'de' } };
export const RtlSmoke: Story = { args: populatedArgs, globals: { locale: 'fr', direction: 'rtl' } };
