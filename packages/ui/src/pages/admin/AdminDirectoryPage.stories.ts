import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminDirectoryPage from './AdminDirectoryPage.svelte';
import { adminNav, directoryPeople, directoryProjects } from './admin-demo.js';

const populatedArgs = {
  navGroups: adminNav('/admin/directory'),
  projects: directoryProjects,
  people: directoryPeople,
};

const meta = {
  title: 'Pages/Admin/Directory',
  component: AdminDirectoryPage,
  parameters: { layout: 'fullscreen' },
  render: (args) => ({ Component: AdminDirectoryPage, props: args }),
} satisfies Meta<typeof AdminDirectoryPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Projects: Story = { args: populatedArgs };
export const People: Story = { args: { ...populatedArgs, initialView: 'people' } };
export const SearchResult: Story = { args: { ...populatedArgs, initialSearch: 'ledger' } };
export const Empty: Story = {
  args: { ...populatedArgs, projects: [], people: [], state: 'empty' },
};
export const Error: Story = { args: { ...populatedArgs, state: 'error' } };
export const Forbidden: Story = { args: { ...populatedArgs, state: 'forbidden' } };
export const Compact: Story = {
  args: populatedArgs,
  parameters: { layout: 'fullscreen', viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { args: populatedArgs, globals: { theme: 'dark' } };
export const German: Story = { args: populatedArgs, globals: { locale: 'de' } };
export const RtlSmoke: Story = { args: populatedArgs, globals: { locale: 'fr', direction: 'rtl' } };
