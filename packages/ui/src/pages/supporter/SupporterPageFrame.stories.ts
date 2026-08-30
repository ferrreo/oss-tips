import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupporterPageFrame from './SupporterPageFrame.svelte';

const meta = {
  title: 'Pages/Supporter/Page frame',
  component: SupporterPageFrame,
  args: {
    current: 'home',
    title: 'Your support',
    lede: 'Memberships, access, and payment history in one place.',
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SupporterPageFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Reading: Story = {
  args: { reading: true, current: 'settings', title: 'Account settings' },
};
export const Error: Story = {
  args: {
    current: 'home',
    error: 'Supporter data is unavailable. Try again in a moment.',
  },
};
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { globals: { theme: 'dark' } };
