import type { Meta, StoryObj } from '@storybook/svelte-vite';
import TermsDocPage from './TermsDocPage.svelte';

const realisticData = { doc: 'privacy' as const, updated: 'Last updated August 2026' };
const meta = {
  title: 'Pages/Public/Terms Document',
  component: TermsDocPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TermsDocPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Privacy: Story = {};
export const AcceptableUse: Story = { args: { ...realisticData, doc: 'acceptable-use' } };
export const Refunds: Story = { args: { ...realisticData, doc: 'refunds' } };
export const Cookies: Story = { args: { ...realisticData, doc: 'cookies' } };
export const UnknownDocument: Story = { args: { ...realisticData, doc: 'not-published' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const French: Story = {
  globals: { locale: 'fr' },
};
export const LongCopy: Story = {
  args: { ...realisticData, updated: '2026-08-01' },
};
export const RtlLongCopy: Story = {
  args: { ...realisticData, doc: 'acceptable-use' },
  globals: { locale: 'pt-BR', direction: 'rtl' },
};
