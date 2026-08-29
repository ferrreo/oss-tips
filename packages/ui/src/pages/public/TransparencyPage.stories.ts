import type { Meta, StoryObj } from '@storybook/svelte-vite';
import TransparencyPage from './TransparencyPage.svelte';

const meta: Meta<TransparencyPage> = {
  title: 'Pages/Public/Transparency',
  component: TransparencyPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
