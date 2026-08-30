import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminCasesPage from './AdminCasesPage.svelte';
import { adminCases, adminNav } from './admin-demo.js';
import { adminViewports } from './admin-story-viewports.js';

const populatedArgs = {
  navGroups: adminNav('/admin/cases'),
  cases: adminCases,
  initialSelectedId: 'CASE-1042',
};

const meta = {
  title: 'Pages/Admin/Cases',
  component: AdminCasesPage,
  parameters: { layout: 'fullscreen' },
  render: (args) => ({ Component: AdminCasesPage, props: args }),
} satisfies Meta<typeof AdminCasesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = { args: populatedArgs };
export const Resolved: Story = {
  args: { ...populatedArgs, initialFilter: 'resolved', initialSelectedId: 'CASE-1022' },
};
export const Empty: Story = { args: { ...populatedArgs, cases: [], state: 'empty' } };
export const Error: Story = { args: { ...populatedArgs, state: 'error' } };
export const Forbidden: Story = { args: { ...populatedArgs, state: 'forbidden' } };
export const Compact: Story = {
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
export const German: Story = { args: populatedArgs, globals: { locale: 'de' } };
export const RtlSmoke: Story = { args: populatedArgs, globals: { locale: 'fr', direction: 'rtl' } };
