import type { Meta, StoryObj } from '@storybook/svelte-vite';
import PaymentsPage from './PaymentsPage.svelte';

const meta: Meta<PaymentsPage> = {
  title: 'Pages/Dashboard/Payments',
  component: PaymentsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
