import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminTable from './AdminTable.svelte';
import { adminViewports } from './admin-story-viewports.js';

const populatedArgs = {
  caption: 'Recent operator actions',
  columns: [
    { key: 'time', label: 'Time' },
    { key: 'target', label: 'Target' },
    { key: 'status', label: 'Status' },
  ],
  rows: [
    { time: '26 Aug 2026, 18:41', target: 'Grove', status: 'Open' },
    { time: '26 Aug 2026, 16:05', target: 'otel-lite', status: 'Review' },
  ],
};

const meta = {
  title: 'Pages/Admin/Table',
  component: AdminTable,
  parameters: { layout: 'fullscreen' },
  render: (args) => ({ Component: AdminTable, props: args }),
} satisfies Meta<typeof AdminTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = { args: populatedArgs };
export const Empty: Story = {
  args: {
    ...populatedArgs,
    rows: [],
    emptyMessage: 'No operator actions match this view.',
  },
};
export const DarkEmpty: Story = {
  args: {
    ...populatedArgs,
    rows: [],
    emptyMessage: 'No operator actions match this view.',
  },
  globals: { theme: 'dark' },
};
export const Compact320: Story = {
  args: populatedArgs,
  parameters: { layout: 'fullscreen', viewport: adminViewports.compact },
};
export const Tablet768: Story = {
  args: populatedArgs,
  parameters: { layout: 'fullscreen', viewport: adminViewports.tablet },
};
export const Wide1280: Story = {
  args: populatedArgs,
  parameters: { layout: 'fullscreen', viewport: adminViewports.wide },
};
export const Dark: Story = { args: populatedArgs, globals: { theme: 'dark' } };
export const RtlSmoke: Story = { args: populatedArgs, globals: { locale: 'fr', direction: 'rtl' } };
