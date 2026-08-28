import type { Meta, StoryObj } from '@storybook/svelte';
import SettingsPage from './SettingsPage.svelte';

const meta: Meta<SettingsPage> = {
  title: 'Pages/Supporter/Settings Alias',
  component: SettingsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
