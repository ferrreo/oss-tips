import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectMembershipsPage from './ProjectMembershipsPage.svelte';
import { demoTiers } from '../../fixtures/demo.js';
import { membershipRows } from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Memberships',
  component: ProjectMembershipsPage,
  parameters: { layout: 'fullscreen' },
  args: { tiers: demoTiers, memberships: membershipRows, onCreateTier: async () => {} },
} satisfies Meta<typeof ProjectMembershipsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { tiers: [], memberships: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
