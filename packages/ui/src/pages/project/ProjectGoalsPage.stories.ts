import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectGoalsPage from './ProjectGoalsPage.svelte';
import { demoGoals } from '../../fixtures/demo.js';
import { extraGoals } from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Goals',
  component: ProjectGoalsPage,
  parameters: { layout: 'fullscreen' },
  args: { goals: [...demoGoals, ...extraGoals], onCreateGoal: async () => {} },
} satisfies Meta<typeof ProjectGoalsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { goals: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
