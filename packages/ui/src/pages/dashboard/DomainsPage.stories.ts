import type { Meta, StoryObj } from '@storybook/svelte';
import DomainsPage from './DomainsPage.svelte';

const meta: Meta<DomainsPage> = {
  title: 'Pages/Dashboard/Domains',
  component: DomainsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
