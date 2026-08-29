import type { Meta, StoryObj } from '@storybook/svelte-vite';
import PricingPage from './PricingPage.svelte';

const meta: Meta<PricingPage> = {
  title: 'Pages/Public/Pricing',
  component: PricingPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
