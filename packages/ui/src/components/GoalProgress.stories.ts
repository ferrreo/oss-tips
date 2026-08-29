import { demoGoals } from '../fixtures/demo.js';
import type { Meta, StoryObj } from '@storybook/svelte';
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

const designDocs = demoGoal('g1');
const adapter = demoGoal('g2');

export const Default: Story = { args: { goal: designDocs } };
export const ActiveSupporters: Story = { args: { goal: adapter } };
export const Dark: Story = { args: { goal: designDocs }, globals: { theme: 'dark' } };
