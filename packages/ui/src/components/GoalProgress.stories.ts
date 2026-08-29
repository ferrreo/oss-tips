import { demoGoals } from "../fixtures/demo.js";
import type { Meta, StoryObj } from '@storybook/svelte';
import GoalProgress from './GoalProgress.svelte';

const meta: Meta<GoalProgress> = {
  title: 'Components/GoalProgress',
  component: GoalProgress,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { goal: demoGoals[0] } };
export const Dark: Story = { args: { goal: demoGoals[0] }, globals: { theme: 'dark' } };
