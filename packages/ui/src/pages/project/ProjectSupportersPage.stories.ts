import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectSupportersPage from './ProjectSupportersPage.svelte';
import { demoSupporters } from '../../fixtures/demo.js';
import { rankedSupporters } from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Supporters',
  component: ProjectSupportersPage,
  parameters: { layout: 'fullscreen' },
  args: { supporters: demoSupporters, rankings: rankedSupporters },
} satisfies Meta<typeof ProjectSupportersPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { supporters: [], rankings: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
