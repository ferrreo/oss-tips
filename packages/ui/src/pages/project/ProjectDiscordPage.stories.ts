import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectDiscordPage from './ProjectDiscordPage.svelte';
import { discordRoleRows } from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Discord',
  component: ProjectDiscordPage,
  parameters: { layout: 'fullscreen' },
  args: {
    roleRows: discordRoleRows,
    discordGuild: { id: '123456789012345678', name: 'oss.tips community', botInstalled: true },
  },
} satisfies Meta<typeof ProjectDiscordPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { roleRows: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
