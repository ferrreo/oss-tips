import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminShellPreview from './AdminShellPreview.svelte';

const sharedArgs = {
  title: 'Overview',
  lede: 'Review queue, settlement volume, and failed jobs.',
  projectContext: 'Acting on Grove. Refunds and restrictions stay on this project.',
};

const meta: Meta<AdminShellPreview> = {
  title: 'Components/AdminShell',
  component: AdminShellPreview,
  parameters: { layout: 'fullscreen' },
  args: sharedArgs,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: sharedArgs,
};

export const Dark: Story = {
  args: sharedArgs,
  globals: { theme: 'dark' },
};

export const NoProject: Story = {
  args: {
    ...sharedArgs,
    projectContext: 'No project selected. Refunds and restrictions need one picked first.',
    lede: 'Nothing here changes money until a project is in context.',
  },
};
