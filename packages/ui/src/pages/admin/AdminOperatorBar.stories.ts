import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminOperatorBar from './AdminOperatorBar.svelte';

const meta = {
  title: 'Pages/Admin/Operator Bar',
  component: AdminOperatorBar,
} satisfies Meta<typeof AdminOperatorBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    context: 'Reviewing Grove',
    detail:
      'github.com/oss-tips/grove. Approve or reject only with a reason. That writes an audit event.',
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
    detail:
      'github.com/oss-tips/grove. Approve or reject only with a reason. That writes an audit event.',
  },
  globals: { theme: 'dark' },
};

export const Warning: Story = {
  args: {
    context: 'Settlement difference needs evidence',
    detail: 'Leave this row open until Stripe and the ledger agree or a timing window is recorded.',
    tone: 'warning',
  },
};

export const RtlSmoke: Story = {
  args: {
    context: 'Reviewing Grove',
    detail: 'github.com/oss-tips/grove. Approve or reject only with a reason.',
  },
  globals: { locale: 'fr', direction: 'rtl' },
};
