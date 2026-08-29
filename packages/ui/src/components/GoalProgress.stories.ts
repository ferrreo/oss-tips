import { demoGoals } from '../fixtures/demo.js';
import type { Meta, StoryObj } from '@storybook/svelte-vite';
import GoalProgress from './GoalProgress.svelte';

const meta: Meta<GoalProgress> = {
  title: 'Components/GoalProgress',
  component: GoalProgress,
};

export default meta;
type Story = StoryObj<typeof meta>;

function demoGoal(id: string) {
  const found = demoGoals.find((goal) => goal.id === id);
  if (!found) throw new Error(`demoGoals is missing ${id}`);
  return found;
}

const infrastructure = demoGoal('g1');
const documentation = demoGoal('g2');

export const Default: Story = { args: { goal: infrastructure } };
export const ActiveSupporters: Story = { args: { goal: documentation } };
export const Dark: Story = { args: { goal: infrastructure }, globals: { theme: 'dark' } };
