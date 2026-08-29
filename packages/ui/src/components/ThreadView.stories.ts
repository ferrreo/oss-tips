import { demoThreads } from "../fixtures/demo.js";
import type { Meta, StoryObj } from '@storybook/svelte';
import ThreadView from './ThreadView.svelte';

const meta: Meta<ThreadView> = {
  title: 'Components/ThreadView',
  component: ThreadView,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { thread: demoThreads[0] } };
export const Dark: Story = { args: { thread: demoThreads[0] }, globals: { theme: 'dark' } };
