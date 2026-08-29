import type { Meta, StoryObj } from '@storybook/svelte-vite';
import StatusBanner from './StatusBanner.svelte';

const meta: Meta<StatusBanner> = {
  title: 'Components/StatusBanner',
  component: StatusBanner,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    variant: 'warning',
    title: 'Stripe still needs identity documents',
    message: 'Grove cannot take payouts until verification finishes.',
  },
};

export const Info: Story = {
  args: {
    variant: 'info',
    title: 'Code sent',
    message: 'Check ada@example.com for a 6-digit sign-in code.',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    title: 'Webhook delivery failed twice',
    message: 'api.grove.dev/hooks returned 500. Retries are paused after the next attempt.',
  },
};

export const Dark: Story = {
  args: {
    variant: 'warning',
    title: 'Stripe still needs identity documents',
    message: 'Grove cannot take payouts until verification finishes.',
  },
  globals: { theme: 'dark' },
};
