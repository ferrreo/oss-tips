import { projectNavGroups } from "../fixtures/demo.js";
import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SidebarNav from './SidebarNav.svelte';

const meta: Meta<SidebarNav> = {
  title: 'Components/SidebarNav',
  component: SidebarNav,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { groups: projectNavGroups } };
export const Dark: Story = { args: { groups: projectNavGroups }, globals: { theme: 'dark' } };
