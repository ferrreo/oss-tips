import type { Meta, StoryObj } from '@storybook/svelte';
import ReconciliationPage from './ReconciliationPage.svelte';

const meta: Meta<ReconciliationPage> = {
  title: 'Pages/Admin/Reconciliation Alias',
  component: ReconciliationPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
