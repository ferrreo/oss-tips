import type { Meta, StoryObj } from '@storybook/svelte-vite';
import BrandWordmark from './BrandWordmark.svelte';

const meta = {
  title: 'Components/BrandWordmark',
  component: BrandWordmark,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof BrandWordmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Wordmark: Story = { args: { variant: 'wordmark' } };
export const Dark: Story = { args: { theme: 'dark' }, globals: { theme: 'dark' } };
export const Mark: Story = { args: { alt: 'oss.tips mark', variant: 'mark' } };
export const DarkMark: Story = {
  args: { alt: 'oss.tips mark', theme: 'dark', variant: 'mark' },
  globals: { theme: 'dark' },
};
export const Compact: Story = {
  args: { size: 'compact' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Decorative: Story = { args: { decorative: true } };
