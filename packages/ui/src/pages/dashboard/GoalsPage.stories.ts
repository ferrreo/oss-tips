import type { Meta, StoryObj } from '@storybook/svelte';
import GoalsPage from './GoalsPage.svelte';

const meta: Meta<GoalsPage> = {
  title: 'Pages/Dashboard/Goals',
  component: GoalsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
