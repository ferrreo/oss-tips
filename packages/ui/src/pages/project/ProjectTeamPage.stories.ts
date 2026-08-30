import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectTeamPage from './ProjectTeamPage.svelte';
import { demoProject } from '../../fixtures/demo.js';
import { teamRows } from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Team',
  component: ProjectTeamPage,
  parameters: { layout: 'fullscreen' },
  args: {
    members: teamRows,
    onInvite: async () => {},
    onTransferOwnership: async () => {},
    projectCapabilities: ['project.transfer_ownership'],
  },
} satisfies Meta<typeof ProjectTeamPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { members: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Closed: Story = { args: { project: { ...demoProject, status: 'closed' } } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
