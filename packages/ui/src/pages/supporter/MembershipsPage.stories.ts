import type { Meta, StoryObj } from '@storybook/svelte-vite';
import MembershipsPage from './MembershipsPage.svelte';

const meta: Meta<MembershipsPage> = {
  title: 'Pages/Supporter/Memberships Alias',
  component: MembershipsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
