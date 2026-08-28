import type { Meta, StoryObj } from '@storybook/svelte';
import ClaimPage from './ClaimPage.svelte';

const meta: Meta<ClaimPage> = {
  title: 'Pages/Public/Claim',
  component: ClaimPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
