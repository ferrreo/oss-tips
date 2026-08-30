import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectApiKeysPage from './ProjectApiKeysPage.svelte';
import { apiKeyRows } from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/API Keys',
  component: ProjectApiKeysPage,
  parameters: { layout: 'fullscreen' },
  args: { keys: apiKeyRows, onCreateKey: async () => 'osk_storybook_7f2ad2e1' },
} satisfies Meta<typeof ProjectApiKeysPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { keys: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
