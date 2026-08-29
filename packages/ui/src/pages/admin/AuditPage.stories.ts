import type { Meta, StoryObj } from '@storybook/svelte';
import AuditPage from './AuditPage.svelte';

const meta: Meta<AuditPage> = {
  title: 'Pages/Admin/Audit Alias',
  component: AuditPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
