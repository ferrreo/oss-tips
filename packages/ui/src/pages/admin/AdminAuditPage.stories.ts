import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminAuditPage from './AdminAuditPage.svelte';
import { adminNav, auditEvents } from './admin-demo.js';

const populatedArgs = {
  navGroups: adminNav('/admin/audit'),
  events: auditEvents,
};

const meta = {
  title: 'Pages/Admin/Audit Log',
  component: AdminAuditPage,
  parameters: { layout: 'fullscreen' },
  render: (args) => ({ Component: AdminAuditPage, props: args }),
} satisfies Meta<typeof AdminAuditPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = { args: populatedArgs };
export const Filtered: Story = { args: { ...populatedArgs, initialFilter: 'reconciliation' } };
export const Empty: Story = { args: { ...populatedArgs, events: [], state: 'empty' } };
export const Error: Story = { args: { ...populatedArgs, state: 'error' } };
export const Forbidden: Story = { args: { ...populatedArgs, state: 'forbidden' } };
export const Compact: Story = {
  args: populatedArgs,
  parameters: { layout: 'fullscreen', viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { args: populatedArgs, globals: { theme: 'dark' } };
export const German: Story = { args: populatedArgs, globals: { locale: 'de' } };
export const RtlSmoke: Story = { args: populatedArgs, globals: { locale: 'fr', direction: 'rtl' } };
