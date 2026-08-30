import type { Meta, StoryObj } from '@storybook/svelte-vite';
import HeroLandscape from './HeroLandscape.svelte';

const meta = {
  title: 'Components/HeroLandscape',
  component: HeroLandscape,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HeroLandscape>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { theme: 'light' } };
export const Dark: Story = { args: { theme: 'dark' }, globals: { theme: 'dark' } };
export const Compact: Story = {
  args: { theme: 'light', compact: true },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const AutomaticTheme: Story = { args: { compact: false } };
