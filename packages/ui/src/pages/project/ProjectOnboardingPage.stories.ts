import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectOnboardingPage from './ProjectOnboardingPage.svelte';
import { demoProject } from '../../fixtures/demo.js';
import { onboardingSteps } from './project-demo.js';

const verification = async (email: string) => ({
  status: 'pending' as const,
  email,
  expires_at: '2026-08-30T12:10:00.000Z',
});
const confirm = async () => ({
  status: 'verified' as const,
  email: 'hello@grove.dev',
  expires_at: null,
});
const supportEmailSteps = onboardingSteps.map((item) =>
  item.step === '1'
    ? {
        ...item,
        detail: '',
        detailKey: 'identity' as const,
        detailValue: demoProject.name,
        status: 'In progress',
      }
    : item,
);

const meta = {
  title: 'Pages/ProjectDashboard/Onboarding',
  component: ProjectOnboardingPage,
  parameters: { layout: 'fullscreen' },
  args: {
    project: { ...demoProject, supportEmailVerified: true },
    steps: onboardingSteps,
    initialStep: 2,
    onVerifyOwnership: async () => {},
    onStartStripe: async () => {},
    onPublish: async () => {},
    onSendSupportEmailVerification: verification,
    onConfirmSupportEmailVerification: confirm,
  },
} satisfies Meta<typeof ProjectOnboardingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ownership: Story = {};
export const SupportEmail: Story = {
  args: {
    initialStep: 1,
    project: { ...demoProject, supportEmailVerified: false },
    steps: supportEmailSteps,
  },
};
export const Stripe: Story = { args: { initialStep: 3 } };
export const Complete: Story = { args: { initialStep: 5 } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
