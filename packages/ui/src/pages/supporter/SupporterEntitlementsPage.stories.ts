import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupporterEntitlementsPage from './SupporterEntitlementsPage.svelte';

const meta: Meta<SupporterEntitlementsPage> = {
  title: 'Pages/Supporter/Entitlements',
  component: SupporterEntitlementsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
