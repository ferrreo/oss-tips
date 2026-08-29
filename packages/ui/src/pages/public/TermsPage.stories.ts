import type { Meta, StoryObj } from '@storybook/svelte-vite';
import TermsPage from './TermsPage.svelte';

const meta: Meta<TermsPage> = {
  title: 'Pages/Public/Terms',
  component: TermsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
