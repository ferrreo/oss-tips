import type { Meta, StoryObj } from '@storybook/svelte';
import ExplorePage from './ExplorePage.svelte';

const meta: Meta<ExplorePage> = {
  title: 'Pages/Public/Explore',
  component: ExplorePage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
