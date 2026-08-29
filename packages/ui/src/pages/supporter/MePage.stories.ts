import type { Meta, StoryObj } from '@storybook/svelte-vite';
import MePage from './MePage.svelte';

const meta: Meta<MePage> = {
  title: 'Pages/Supporter/Me',
  component: MePage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
