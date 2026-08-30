import { demoSupporters } from '../fixtures/demo.js';
import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupporterWall from './SupporterWall.svelte';

const meta = {
  title: 'Components/SupporterWall',
  component: SupporterWall,
} satisfies Meta<typeof SupporterWall>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { supporters: demoSupporters } };
export const PrivateRecognition: Story = {
  args: { supporters: demoSupporters, showAmounts: false },
};
export const Empty: Story = { args: { supporters: [] } };
export const Compact: Story = {
  args: { supporters: demoSupporters },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { args: { supporters: demoSupporters }, globals: { theme: 'dark' } };
