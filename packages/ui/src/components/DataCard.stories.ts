import type { Meta, StoryObj } from '@storybook/svelte-vite';
import DataCard from './DataCard.svelte';

const meta = {
  title: 'Components/DataCard',
  component: DataCard,
} satisfies Meta<typeof DataCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'MRR',
    value: '£12,450',
    compare: '+8% vs last month',
    compareDirection: 'up',
    sparkline: [980, 1010, 1040, 1090, 1125, 1180, 1245],
  },
};

export const Down: Story = {
  args: {
    label: 'Churn',
    value: '2.1%',
    compare: '−0.4 vs prior 30 days',
    compareDirection: 'down',
    sparkline: [3.1, 2.8, 2.6, 2.4, 2.3, 2.2, 2.1],
  },
};

export const Neutral: Story = {
  args: {
    label: 'Refunds this month',
    value: '12',
    compare: 'Same as last month',
    compareDirection: 'neutral',
  },
};

export const Compact: Story = {
  args: {
    label: 'Average monthly recurring support from active supporters',
    value: '£1,245',
    compare: '+8% vs last month',
    compareDirection: 'up',
    sparkline: [980, 1010, 1040, 1090, 1125, 1180, 1245],
  },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const Dark: Story = {
  args: {
    label: 'MRR',
    value: '£12,450',
    compare: '+8% vs last month',
    compareDirection: 'up',
    sparkline: [980, 1010, 1040, 1090, 1125, 1180, 1245],
  },
  globals: { theme: 'dark' },
};
