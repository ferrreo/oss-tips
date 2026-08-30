import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminStatePanel from './AdminStatePanel.svelte';

const meta = {
  title: 'Pages/Admin/State Panel',
  component: AdminStatePanel,
} satisfies Meta<typeof AdminStatePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { state: 'empty' },
};

export const Error: Story = {
  args: {
    state: 'error',
    actionLabel: 'Retry request',
  },
};

export const Forbidden: Story = {
  args: {
    state: 'forbidden',
    actionLabel: 'Return to overview',
  },
};

export const Dark: Story = {
  args: { state: 'error', actionLabel: 'Retry request' },
  globals: { theme: 'dark' },
};

export const RtlSmoke: Story = {
  args: { state: 'forbidden', actionLabel: 'Return to overview' },
  globals: { locale: 'fr', direction: 'rtl' },
};
