import { adminNavGroups } from "../fixtures/demo.js";
import type { Meta, StoryObj } from '@storybook/svelte';
import AdminShell from './AdminShell.svelte';

const meta: Meta<AdminShell> = {
  title: 'Components/AdminShell',
  component: AdminShell,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { navGroups: adminNavGroups, title: "Platform overview" } };
export const Dark: Story = { args: { navGroups: adminNavGroups, title: "Platform overview" }, globals: { theme: 'dark' } };
