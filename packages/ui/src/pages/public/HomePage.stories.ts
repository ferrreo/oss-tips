import type { Meta, StoryObj } from '@storybook/svelte';
import HomePage from './HomePage.svelte';

const meta: Meta<HomePage> = {
  title: 'Pages/Public/Home',
  component: HomePage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
