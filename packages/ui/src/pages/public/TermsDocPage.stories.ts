import type { Meta, StoryObj } from '@storybook/svelte-vite';
import TermsDocPage from './TermsDocPage.svelte';

const meta: Meta<TermsDocPage> = {
  title: 'Pages/Public/Terms Document',
  component: TermsDocPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
