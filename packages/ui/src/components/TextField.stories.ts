import type { Meta, StoryObj } from '@storybook/svelte-vite';
import TextField from './TextField.svelte';

const meta = {
  title: 'Components/TextField',
  component: TextField,
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { id: 'account-email', label: 'Email', value: 'you@example.com' },
};
export const WithHelp: Story = {
  args: {
    id: 'supporter-name',
    label: 'Name',
    value: 'Alex Morgan',
    help: 'Use name shown on your supporter profile.',
  },
};
export const Error: Story = {
  args: {
    id: 'project-slug',
    label: 'Project slug',
    value: 'oss.tips',
    error: 'Use lowercase letters, numbers, and hyphens.',
  },
};
export const Disabled: Story = {
  args: { id: 'locked-email', label: 'Email', value: 'alex@example.com', disabled: true },
};
export const Dark: Story = {
  args: { id: 'dark-email', label: 'Email', value: 'you@example.com' },
  globals: { theme: 'dark' },
};
