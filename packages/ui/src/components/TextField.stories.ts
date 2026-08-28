import type { Meta, StoryObj } from '@storybook/svelte';
import TextField from './TextField.svelte';

const meta: Meta<TextField> = {
  title: 'Components/TextField',
  component: TextField,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { label: "Email", value: "you@example.com" } };
export const Dark: Story = { args: { label: "Email", value: "you@example.com" }, globals: { theme: 'dark' } };
