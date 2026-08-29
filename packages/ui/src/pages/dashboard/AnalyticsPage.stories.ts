import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AnalyticsPage from './AnalyticsPage.svelte';

const meta: Meta<AnalyticsPage> = {
  title: 'Pages/Dashboard/Analytics',
  component: AnalyticsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
