import { projectNavGroups } from '../fixtures/demo.js';
import type { Meta, StoryObj } from '@storybook/svelte-vite';
import DashboardShellPreview from './DashboardShellPreview.svelte';

const meta: Meta<DashboardShellPreview> = {
  title: 'Components/DashboardShell',
  component: DashboardShellPreview,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    projectName: 'Grove',
    navGroups: projectNavGroups,
    title: 'Overview',
    lede: 'Revenue, unanswered inbox, and the current goal.',
  },
};

export const Dark: Story = {
  args: {
    projectName: 'Grove',
    navGroups: projectNavGroups,
    title: 'Overview',
    lede: 'Revenue, unanswered inbox, and the current goal.',
  },
  globals: { theme: 'dark' },
};
