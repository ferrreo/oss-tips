import type { Meta, StoryObj } from '@storybook/svelte-vite';
import StatusBanner from './StatusBanner.svelte';

const meta = {
  title: 'Components/StatusBanner',
  component: StatusBanner,
} satisfies Meta<typeof StatusBanner>;

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

export const Compact: Story = {
  args: {
    variant: 'danger',
    title: 'Export needs attention',
    message: 'The May ledger contains two records that need review before you download it.',
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
