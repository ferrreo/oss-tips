import type { Meta, StoryObj } from '@storybook/svelte';
import ApiKeysPage from './ApiKeysPage.svelte';

const meta: Meta<ApiKeysPage> = {
  title: 'Pages/Dashboard/ApiKeys',
  component: ApiKeysPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
