import type { Meta, StoryObj } from '@storybook/svelte-vite';
import GuestClaimPage from './GuestClaimPage.svelte';

const meta: Meta<GuestClaimPage> = {
  title: 'Pages/Public/Guest Claim',
  component: GuestClaimPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
