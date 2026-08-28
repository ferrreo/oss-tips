import type { Meta, StoryObj } from '@storybook/svelte';
import EntitlementsPage from './EntitlementsPage.svelte';

const meta: Meta<EntitlementsPage> = {
  title: 'Pages/Supporter/Entitlements Alias',
  component: EntitlementsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
