import type { Meta, StoryObj } from '@storybook/svelte';
import ExportsPage from './ExportsPage.svelte';

const meta: Meta<ExportsPage> = {
  title: 'Pages/Dashboard/Exports',
  component: ExportsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
