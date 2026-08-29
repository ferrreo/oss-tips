import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupportOverTimeChart from './SupportOverTimeChart.svelte';
import { demoGrowthSeries, demoRevenueSeries } from './chartModel.js';

const meta: Meta<SupportOverTimeChart> = {
  title: 'Components/SupportOverTimeChart',
  component: SupportOverTimeChart,
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

export const SupporterGrowth: Story = {
  args: {
    label: 'Supporter growth',
    range: 'Last 90 days',
    series: demoGrowthSeries(),
  },
};
