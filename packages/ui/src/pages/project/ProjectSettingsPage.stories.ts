import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectSettingsPage from './ProjectSettingsPage.svelte';
import { demoProject } from '../../fixtures/demo.js';
import { settingsLinks } from './project-demo.js';

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

const meta = {
  title: 'Pages/ProjectDashboard/Settings',
  component: ProjectSettingsPage,
  parameters: { layout: 'fullscreen' },
  args: {
    links: settingsLinks,
    onSave: async () => {},
    onCloseProject: async () => {},
    projectCapabilities: ['project.delete'],
    onSendSupportEmailVerification: verification,
    onConfirmSupportEmailVerification: confirm,
  },
} satisfies Meta<typeof ProjectSettingsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Verified: Story = {
  args: { project: { ...demoProject, supportEmailVerified: true } },
};
export const ConfiguredSupportLimits: Story = {
  args: { project: { ...demoProject, minSupportMinor: 500, maxSupportMinor: 250000 } },
};
export const GatedPostMetadataOptIn: Story = {
  args: { project: { ...demoProject, showGatedPostMetadata: true } },
};
export const JapaneseYenSupportLimits: Story = {
  args: {
    project: { ...demoProject, currency: 'JPY', minSupportMinor: 500, maxSupportMinor: 50000 },
  },
};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Closed: Story = { args: { project: { ...demoProject, status: 'closed' } } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
