import type { Meta, StoryObj } from '@storybook/svelte-vite';
import TeamInvitePage from './TeamInvitePage.svelte';
import { demoProject } from '../../fixtures/demo.js';

const realisticData = {
  invite: {
    id: '0198d6e8-0000-7000-8000-000000000042',
    project: { name: demoProject.name, slug: demoProject.slug },
    role: 'editor',
    status: 'pending' as const,
    expiresAt: '2026-09-07T00:00:00.000Z',
  },
  session: { email: 'ada@grove.dev' },
  state: 'ready' as const,
};

const meta = {
  title: 'Pages/Public/Team Invite',
  component: TeamInvitePage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TeamInvitePage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Accepting: Story = {
  args: { ...realisticData, onAccept: () => new Promise<never>(() => {}) },
  play: ({ canvasElement }) => {
    const button = Array.from(canvasElement.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === 'Accept invitation',
    );
    button?.click();
  },
};
export const SignedOut: Story = {
  args: { ...realisticData, session: null, state: 'signed-out' },
};
export const Mismatch: Story = {
  args: { ...realisticData, session: { email: 'other@example.com' }, state: 'mismatch' },
};
export const Expired: Story = {
  args: {
    ...realisticData,
    state: 'expired',
    invite: { ...realisticData.invite, expiresAt: '2026-08-01T00:00:00.000Z' },
  },
};
export const Accepted: Story = {
  args: {
    ...realisticData,
    state: 'accepted',
    invite: { ...realisticData.invite, status: 'accepted' },
  },
};
export const Used: Story = {
  args: { ...realisticData, state: 'used', invite: { ...realisticData.invite, status: 'revoked' } },
};
export const Missing: Story = {
  args: { invite: null, inviteId: realisticData.invite.id, session: null, state: 'missing' },
};
export const Error: Story = {
  args: { invite: null, inviteId: realisticData.invite.id, session: null, state: 'error' },
};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Rtl: Story = {
  globals: { locale: 'fr', direction: 'rtl' },
};
