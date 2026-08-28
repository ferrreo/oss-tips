import type { Meta, StoryObj } from '@storybook/svelte';
import OverviewPage from './OverviewPage.svelte';

const meta: Meta<OverviewPage> = {
  title: 'Pages/Dashboard/Overview',
  component: OverviewPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
