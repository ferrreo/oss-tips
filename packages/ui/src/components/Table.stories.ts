import type { Meta, StoryObj } from '@storybook/svelte';
import Table from './Table.svelte';

const meta: Meta<Table> = {
  title: 'Components/Table',
  component: Table,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { columns: [{ key: "a", label: "Name" }], rows: [{ a: "Row" }] } };
export const Dark: Story = { args: { columns: [{ key: "a", label: "Name" }], rows: [{ a: "Row" }] }, globals: { theme: 'dark' } };
