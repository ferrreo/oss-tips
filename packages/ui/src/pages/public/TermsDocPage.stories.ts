import type { Meta, StoryObj } from '@storybook/svelte';
import TermsDocPage from './TermsDocPage.svelte';

const meta: Meta<TermsDocPage> = {
  title: 'Pages/Public/Terms Document',
  component: TermsDocPage,
  parameters: { layout: 'fullscreen' },
  args: { doc: 'privacy' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Privacy: Story = { args: { doc: 'privacy' } };
export const AcceptableUse: Story = { args: { doc: 'acceptable-use' } };
export const Refunds: Story = { args: { doc: 'refunds' } };
export const Cookies: Story = { args: { doc: 'cookies' } };
export const Dark: Story = { args: { doc: 'privacy' }, globals: { theme: 'dark' } };
