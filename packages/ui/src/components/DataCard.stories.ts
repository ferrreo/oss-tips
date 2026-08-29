import type { Meta, StoryObj } from '@storybook/svelte';
import DataCard from './DataCard.svelte';

const meta: Meta<DataCard> = {
  title: 'Components/DataCard',
  component: DataCard,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { label: "MRR", value: "£12,450", compare: "+8%", compareDirection: "up" } };
export const Dark: Story = { args: { label: "MRR", value: "£12,450", compare: "+8%", compareDirection: "up" }, globals: { theme: 'dark' } };
