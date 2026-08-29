import type { Meta, StoryObj } from '@storybook/svelte';
import DataCard from './DataCard.svelte';

const meta: Meta<DataCard> = {
  title: 'Components/DataCard',
  component: DataCard,
};

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
