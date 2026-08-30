import type { Meta, StoryObj } from '@storybook/svelte-vite';
import DashboardShell from './DashboardShell.svelte';
import { projectNavGroups } from '../fixtures/demo.js';

const tabletViewport = {
  defaultViewport: 'tablet',
  viewports: { tablet: { name: 'Tablet 768', styles: { width: '768px', height: '800px' } } },
};

const meta = {
  title: 'Components/DashboardShell',
  component: DashboardShell,
  parameters: { layout: 'fullscreen' },
  args: {
    projectName: 'Grove',
    navGroups: projectNavGroups,
    title: 'Overview',
    lede: 'Revenue, unanswered inbox, and the current goal.',
  },
} satisfies Meta<typeof DashboardShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'compact',
      viewports: { compact: { name: 'Compact 320', styles: { width: '320px', height: '800px' } } },
    },
  },
};

export const Tablet: Story = {
  parameters: { viewport: tabletViewport },
};

export const CompactOpen: Story = {
  args: { initialMenuOpen: true },
  parameters: {
    viewport: {
      defaultViewport: 'compact',
      viewports: { compact: { name: 'Compact 320', styles: { width: '320px', height: '800px' } } },
    },
  },
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};

export const RTLLayoutSmoke: Story = {
  globals: { locale: 'de', direction: 'rtl' },
};

export const DarkCompactOpen: Story = {
  args: { initialMenuOpen: true },
  globals: { theme: 'dark' },
  parameters: {
    viewport: {
      defaultViewport: 'compact',
      viewports: { compact: { name: 'Compact 320', styles: { width: '320px', height: '800px' } } },
    },
  },
};
