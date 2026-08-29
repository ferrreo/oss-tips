import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupportersPage from './SupportersPage.svelte';

const meta: Meta<SupportersPage> = {
  title: 'Pages/Dashboard/Supporters',
  component: SupportersPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
