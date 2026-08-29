import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupporterSettingsPage from './SupporterSettingsPage.svelte';

const meta: Meta<SupporterSettingsPage> = {
  title: 'Pages/Supporter/Settings',
  component: SupporterSettingsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
