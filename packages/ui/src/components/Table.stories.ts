import type { Meta, StoryObj } from '@storybook/svelte-vite';
import Table from './Table.svelte';

const meta = {
  title: 'Components/Table',
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const columns = [
  { key: 'project', label: 'Project' },
  { key: 'supporters', label: 'Supporters' },
  { key: 'monthly', label: 'Monthly support' },
];

const rows = [
  { project: 'Grove', supporters: 284, monthly: '£1,245' },
  { project: 'Field Notes', supporters: 119, monthly: '£680' },
  { project: 'Plain Text', supporters: 67, monthly: '£412' },
];

export const Default: Story = {
  args: { columns, rows, caption: 'Current projects and recurring support' },
};
export const Mobile: Story = {
  args: {
    columns,
    rows: [
      { project: 'A project with a longer name', supporters: 284, monthly: '£1,245 per month' },
    ],
    caption: 'The same rows become labelled cards on narrow screens',
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = {
  args: { columns, rows, caption: 'Current projects and recurring support' },
  globals: { theme: 'dark' },
};
