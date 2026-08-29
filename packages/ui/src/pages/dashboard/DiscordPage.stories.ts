import type { Meta, StoryObj } from '@storybook/svelte';
import DiscordPage from './DiscordPage.svelte';

const meta: Meta<DiscordPage> = {
  title: 'Pages/Dashboard/Discord',
  component: DiscordPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
