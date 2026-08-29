import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SecurityPage from './SecurityPage.svelte';

const meta: Meta<SecurityPage> = {
  title: 'Pages/Public/Security',
  component: SecurityPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
