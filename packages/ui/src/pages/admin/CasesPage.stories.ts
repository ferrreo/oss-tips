import type { Meta, StoryObj } from '@storybook/svelte';
import CasesPage from './CasesPage.svelte';

const meta: Meta<CasesPage> = {
  title: 'Pages/Admin/Cases Alias',
  component: CasesPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
