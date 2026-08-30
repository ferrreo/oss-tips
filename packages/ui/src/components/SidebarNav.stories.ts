import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SidebarNav from './SidebarNav.svelte';
import { adminNavGroups, projectNavGroups } from '../fixtures/demo.js';

const meta = {
  title: 'Components/SidebarNav',
  component: SidebarNav,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SidebarNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Project: Story = {
  args: { groups: projectNavGroups, ariaLabel: 'Project dashboard navigation' },
};

export const Admin: Story = {
  args: { groups: adminNavGroups, ariaLabel: 'Admin navigation', tone: 'admin' },
};

export const Compact: Story = {
  args: { groups: projectNavGroups, ariaLabel: 'Project dashboard navigation' },
  globals: { locale: 'de' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const Dark: Story = {
  args: { groups: projectNavGroups, ariaLabel: 'Project dashboard navigation' },
  globals: { theme: 'dark' },
};
