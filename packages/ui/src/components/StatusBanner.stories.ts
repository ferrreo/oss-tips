import type { Meta, StoryObj } from '@storybook/svelte-vite';
import StatusBanner from './StatusBanner.svelte';

const meta: Meta<StatusBanner> = {
  title: 'Components/StatusBanner',
  component: StatusBanner,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { variant: "warning", title: "Action required", message: "Complete Stripe verification." } };
export const Dark: Story = { args: { variant: "warning", title: "Action required", message: "Complete Stripe verification." }, globals: { theme: 'dark' } };
