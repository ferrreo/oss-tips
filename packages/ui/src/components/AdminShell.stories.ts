import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminShell from './AdminShell.svelte';
import { adminNavGroups } from '../fixtures/demo.js';

const tabletViewport = {
  defaultViewport: 'tablet',
  viewports: { tablet: { name: 'Tablet 768', styles: { width: '768px', height: '800px' } } },
};

const meta = {
  title: 'Components/AdminShell',
  component: AdminShell,
  parameters: { layout: 'fullscreen' },
  args: {
    navGroups: adminNavGroups,
    title: 'Overview',
    lede: 'Review queue, settlement volume, and failed jobs.',
    projectContext: 'Acting on Grove. Refunds and restrictions stay on this project.',
  },
} satisfies Meta<typeof AdminShell>;

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

export const NoProject: Story = {
  args: {
    projectContext: 'No project selected. Refunds and restrictions need one picked first.',
    lede: 'Nothing here changes money until a project is in context.',
  },
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
