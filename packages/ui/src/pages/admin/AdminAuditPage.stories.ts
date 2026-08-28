import type { Meta, StoryObj } from '@storybook/svelte';
import AdminAuditPage from './AdminAuditPage.svelte';

const meta: Meta<AdminAuditPage> = {
  title: 'Pages/Admin/Audit Log',
  component: AdminAuditPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
