import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectOnboardingPage from './ProjectOnboardingPage.svelte';

const meta: Meta<ProjectOnboardingPage> = {
  title: 'Pages/ProjectDashboard/Onboarding',
  component: ProjectOnboardingPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
