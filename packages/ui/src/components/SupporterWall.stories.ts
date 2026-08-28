import { demoSupporters } from "../fixtures/demo.js";
import type { Meta, StoryObj } from '@storybook/svelte';
import SupporterWall from './SupporterWall.svelte';

const meta: Meta<SupporterWall> = {
  title: 'Components/SupporterWall',
  component: SupporterWall,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { supporters: demoSupporters } };
export const Dark: Story = { args: { supporters: demoSupporters }, globals: { theme: 'dark' } };
