import type { Meta, StoryObj } from '@storybook/svelte-vite';
import { demoProject } from '../../fixtures/demo.js';
import ProjectDomainsPage from './ProjectDomainsPage.svelte';
import { domainRows } from './project-demo.js';

const domainProject = { ...demoProject, feeMode: 'project_5pct' as const };

const meta = {
  title: 'Pages/ProjectDashboard/Domains',
  component: ProjectDomainsPage,
  parameters: { layout: 'fullscreen' },
  args: { project: domainProject, records: domainRows, onVerify: async () => undefined },
} satisfies Meta<typeof ProjectDomainsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { records: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Checking: Story = { args: { verificationState: 'loading' } };
export const VerificationError: Story = {
  args: {
    verificationState: 'error',
    verificationError: 'TXT record is not visible yet. DNS can take a few minutes to settle.',
  },
};
export const StandardMode: Story = {
  args: { project: demoProject, records: [] },
};
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
