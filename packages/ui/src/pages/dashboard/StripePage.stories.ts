import type { Meta, StoryObj } from '@storybook/svelte';
import StripePage from './StripePage.svelte';

const meta: Meta<StripePage> = {
  title: 'Pages/Dashboard/Stripe',
  component: StripePage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
