import type { Meta, StoryObj } from '@storybook/svelte-vite';
import HeroLandscape from './HeroLandscape.svelte';

const meta: Meta<HeroLandscape> = {
  title: 'Components/HeroLandscape',
  component: HeroLandscape,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { theme: 'light' } };
export const Dark: Story = { args: { theme: 'dark' }, globals: { theme: 'dark' } };
export const Compact: Story = { args: { theme: 'light', compact: true } };
