import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectAnalyticsPage from './ProjectAnalyticsPage.svelte';
import {
  analyticsDemoMetrics,
  analyticsBreakdown,
  supportOverTimeSeries,
  supporterGrowthSeries,
} from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Analytics',
  component: ProjectAnalyticsPage,
  parameters: { layout: 'fullscreen' },
  args: {
    supportSeries: supportOverTimeSeries,
    growthSeries: supporterGrowthSeries,
    breakdown: analyticsBreakdown,
    metrics: analyticsDemoMetrics,
  },
} satisfies Meta<typeof ProjectAnalyticsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { supportSeries: [], growthSeries: [], breakdown: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
