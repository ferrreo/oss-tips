import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectLifecyclePanel from './ProjectLifecyclePanel.svelte';

const members = [
  { name: 'Mina Patel', email: 'mina@oss.tips', role: 'admin' },
  { name: 'Eli Brooks', email: 'eli@oss.tips', role: 'editor' },
];

const meta = {
  title: 'Components/ProjectLifecyclePanel',
  component: ProjectLifecyclePanel,
  parameters: { layout: 'centered' },
  args: {
    projectName: 'Grove',
    projectStatus: 'published',
    projectCapabilities: ['project.transfer_ownership', 'project.delete'],
    teamMembers: members,
    onTransferOwnership: async () => {},
    onCloseProject: async () => {},
  },
} satisfies Meta<typeof ProjectLifecyclePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const NoTransferTargets: Story = { args: { teamMembers: [] } };
export const Closed: Story = { args: { projectStatus: 'closed' } };
export const Blocked: Story = {
  args: {
    initialError: 'Project cannot be closed yet. Resolve active memberships first.',
  },
};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
