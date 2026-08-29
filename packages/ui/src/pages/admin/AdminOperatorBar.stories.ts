import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminOperatorBar from './AdminOperatorBar.svelte';

const meta: Meta<AdminOperatorBar> = {
  title: 'Pages/Admin/Operator Bar',
  component: AdminOperatorBar,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    context: 'Reviewing Grove',
    detail: 'github.com/oss-tips/grove. Approve or reject only with a reason. That writes an audit event.',
  },
};

export const ContextOnly: Story = {
  args: {
    context: 'Ops workspace, not a project dashboard',
  },
};

export const Dark: Story = {
  args: {
    context: 'Reviewing Grove',
    detail: 'github.com/oss-tips/grove. Approve or reject only with a reason. That writes an audit event.',
  },
  globals: { theme: 'dark' },
};
