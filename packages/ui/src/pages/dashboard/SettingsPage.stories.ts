import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SettingsPage from './SettingsPage.svelte';

const meta: Meta<SettingsPage> = {
  title: 'Pages/Dashboard/Settings',
  component: SettingsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
