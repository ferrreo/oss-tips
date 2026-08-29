import type { Meta, StoryObj } from '@storybook/svelte';
import CheckoutSuccessPage from './CheckoutSuccessPage.svelte';

const meta: Meta<CheckoutSuccessPage> = {
  title: 'Pages/Public/Checkout Success',
  component: CheckoutSuccessPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
