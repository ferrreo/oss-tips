import type { Meta, StoryObj } from '@storybook/svelte-vite';
import AdminOverviewPage from './AdminOverviewPage.svelte';
import {
  adminOverviewMetrics,
  adminCases,
  adminNav,
  failedJobs,
  reconciliationRows,
  reviewQueue,
} from './admin-demo.js';
import { adminViewports } from './admin-story-viewports.js';

const populatedArgs = {
  navGroups: adminNav('/admin'),
  overviewMetrics: adminOverviewMetrics,
  reviewItems: reviewQueue,
  cases: adminCases,
  reconciliation: reconciliationRows,
  failedJobs,
};

const meta = {
  title: 'Pages/Admin/Overview',
  component: AdminOverviewPage,
  parameters: { layout: 'fullscreen' },
  render: (args) => ({ Component: AdminOverviewPage, props: args }),
} satisfies Meta<typeof AdminOverviewPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = { args: populatedArgs };
export const NoSettlementData: Story = {
  args: {
    ...populatedArgs,
    overviewMetrics: {
      ...adminOverviewMetrics,
      settlementVolume: null,
      previousSettlementVolume: null,
      fees: null,
      tips: null,
      currencyCodes: [],
      settledVolumeSeries: [],
    },
  },
};
export const Empty: Story = {
  args: {
    ...populatedArgs,
    reviewItems: [],
    cases: [],
    reconciliation: [],
    failedJobs: [],
    state: 'empty',
  },
};
export const Error: Story = { args: { ...populatedArgs, state: 'error' } };
export const Forbidden: Story = { args: { ...populatedArgs, state: 'forbidden' } };
export const Compact: Story = {
  args: populatedArgs,
  parameters: { layout: 'fullscreen', viewport: adminViewports.compact },
};
export const Tablet768: Story = {
  args: populatedArgs,
  parameters: { layout: 'fullscreen', viewport: adminViewports.tablet },
};
export const Wide1280: Story = {
  args: populatedArgs,
  parameters: { layout: 'fullscreen', viewport: adminViewports.wide },
};
export const Dark: Story = { args: populatedArgs, globals: { theme: 'dark' } };
export const German: Story = { args: populatedArgs, globals: { locale: 'de' } };
export const RtlSmoke: Story = { args: populatedArgs, globals: { locale: 'fr', direction: 'rtl' } };
