import type { Meta, StoryObj } from '@storybook/svelte';
import OnboardingPage from './OnboardingPage.svelte';

const meta: Meta<OnboardingPage> = {
  title: 'Pages/Dashboard/Onboarding',
  component: OnboardingPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
