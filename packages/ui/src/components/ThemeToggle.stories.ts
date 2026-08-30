import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ThemeToggle from './ThemeToggle.svelte';

const meta = {
  title: 'Components/ThemeToggle',
  component: ThemeToggle,
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const System: Story = { args: { preference: 'system' } };
export const Light: Story = { args: { preference: 'light' } };
export const Dark: Story = { args: { preference: 'dark' }, globals: { theme: 'dark' } };
export const Compact: Story = {
  args: { preference: 'dark' },
  globals: { theme: 'dark' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
