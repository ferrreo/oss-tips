import type { Meta, StoryObj } from '@storybook/svelte';
import ChartPlaceholder from './ChartPlaceholder.svelte';
import { demoRevenueSeries } from './chartModel.js';

const meta: Meta<ChartPlaceholder> = {
  title: 'Components/ChartPlaceholder',
  component: ChartPlaceholder,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Revenue — one-off vs recurring',
    range: 'Last 30 days · Europe/London',
    series: demoRevenueSeries(),
    unit: 'GBP',
  },
};

export const Dark: Story = {
  args: {
    label: 'Revenue — one-off vs recurring',
    range: 'Last 30 days · Europe/London',
    series: demoRevenueSeries(),
    unit: 'GBP',
  },
  globals: { theme: 'dark' },
};
