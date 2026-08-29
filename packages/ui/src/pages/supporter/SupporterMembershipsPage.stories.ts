import type { Meta, StoryObj } from '@storybook/svelte';
import SupporterMembershipsPage from './SupporterMembershipsPage.svelte';

const meta: Meta<SupporterMembershipsPage> = {
  title: 'Pages/Supporter/Memberships',
  component: SupporterMembershipsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
