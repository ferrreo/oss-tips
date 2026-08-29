import type { Meta, StoryObj } from '@storybook/svelte-vite';
import DocsPage from './DocsPage.svelte';

const meta: Meta<DocsPage> = {
  title: 'Pages/Public/Docs',
  component: DocsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
