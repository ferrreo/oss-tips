import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupportOverTimeChart from './SupportOverTimeChart.svelte';
import { demoGrowthSeries, demoRevenueSeries } from './chartModel.js';

const meta = {
  title: 'Components/SupportOverTimeChart',
  component: SupportOverTimeChart,
} satisfies Meta<typeof SupportOverTimeChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Revenue: one-off vs recurring',
    range: 'Last 30 days, Europe/London',
    series: demoRevenueSeries(),
    unit: 'GBP',
  },
};

export const Dark: Story = {
  args: {
    label: 'Revenue: one-off vs recurring',
    range: 'Last 30 days, Europe/London',
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

export const Compact: Story = {
  args: {
    label: 'Supporter growth',
    range: 'Last 90 days, Europe/London',
    series: demoGrowthSeries(),
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const Empty: Story = {
  args: {
    label: 'Supporter growth',
    range: 'No reporting window selected',
    series: [],
  },
};
