import { projectNavGroups } from "../fixtures/demo.js";
import type { Meta, StoryObj } from '@storybook/svelte';
import DashboardShell from './DashboardShell.svelte';

const meta: Meta<DashboardShell> = {
  title: 'Components/DashboardShell',
  component: DashboardShell,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { projectName: "Paperlight", navGroups: projectNavGroups, title: "Overview" } };
export const Dark: Story = { args: { projectName: "Paperlight", navGroups: projectNavGroups, title: "Overview" }, globals: { theme: 'dark' } };
