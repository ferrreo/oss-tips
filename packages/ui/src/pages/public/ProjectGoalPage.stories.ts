import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectGoalPage from './ProjectGoalPage.svelte';
import { demoGoals, demoProject } from '../../fixtures/demo.js';

const goal = demoGoals.find((item) => item.slug === 'infrastructure-upgrade');
const documentationGoal = demoGoals.find((item) => item.slug === 'documentation-overhaul');
if (!goal || !documentationGoal) throw new Error('Grove demo goals are missing');
const realisticData = {
  project: demoProject,
  goal,
  goals: demoGoals,
  slug: 'infrastructure-upgrade',
  notes: [
    'Uses settled project support before Stripe and oss.tips fees.',
    'Excludes the optional supporter tip to oss.tips.',
    'Refunds and chargebacks reduce the raised total.',
  ],
};
const meta = {
  title: 'Pages/Public/Project Goal',
  component: ProjectGoalPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProjectGoalPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const DocumentationGoal: Story = {
  args: { ...realisticData, goal: documentationGoal, slug: 'documentation-overhaul' },
};
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const German: Story = {
  globals: { locale: 'de' },
};
export const LongCopy: Story = {
  args: {
    ...realisticData,
    notes: realisticData.notes.map(
      (note) => `${note} This longer note keeps the goal basis explicit for every supporter.`,
    ),
  },
};
export const RtlLongCopy: Story = {
  globals: { locale: 'fr', direction: 'rtl' },
};
