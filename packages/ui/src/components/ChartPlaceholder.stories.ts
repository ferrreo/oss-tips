import type { Meta, StoryObj } from '@storybook/svelte';
import ChartPlaceholder from './ChartPlaceholder.svelte';

const meta: Meta<ChartPlaceholder> = {
  title: 'Components/ChartPlaceholder',
  component: ChartPlaceholder,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { label: "Revenue", range: "Last 30 days" } };
export const Dark: Story = { args: { label: "Revenue", range: "Last 30 days" }, globals: { theme: 'dark' } };
