import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectOverviewPage from './ProjectOverviewPage.svelte';
import { demoGoals } from '../../fixtures/demo.js';
import {
  inboxPreviewRows,
  overviewMetrics,
  rankedSupporters,
  supportOverTimeSeries,
  toolCards,
} from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Overview',
  component: ProjectOverviewPage,
  parameters: { layout: 'fullscreen' },
  args: {
    metrics: overviewMetrics,
    goals: demoGoals,
    inbox: inboxPreviewRows,
    supporters: rankedSupporters,
    tools: toolCards,
    chartSeries: supportOverTimeSeries,
  },
} satisfies Meta<typeof ProjectOverviewPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = {
  args: { goals: [], inbox: [], supporters: [], tools: [], chartSeries: [] },
};
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
