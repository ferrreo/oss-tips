import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectDashShell from './ProjectDashShell.svelte';
import { demoProject, projectNavGroups } from '../../fixtures/demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Dash Shell',
  component: ProjectDashShell,
  parameters: { layout: 'fullscreen' },
  args: {
    project: demoProject,
    navGroups: projectNavGroups,
    title: 'Overview',
    lede: 'Support, inbox, and goals for Grove.',
  },
} satisfies Meta<typeof ProjectDashShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
