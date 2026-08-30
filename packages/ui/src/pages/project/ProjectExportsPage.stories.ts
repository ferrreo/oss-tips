import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectExportsPage from './ProjectExportsPage.svelte';
import { exportRows } from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Exports',
  component: ProjectExportsPage,
  parameters: { layout: 'fullscreen' },
  args: { exports: exportRows, onRequestExport: async () => {} },
} satisfies Meta<typeof ProjectExportsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const LifecycleStates: Story = { args: { exports: exportRows } };
export const ReadyOnly: Story = {
  args: {
    exports: exportRows.filter((item) => item.status === 'ready' && item.downloadUrl),
  },
};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { exports: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
