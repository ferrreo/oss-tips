import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupportEmailVerification from './SupportEmailVerification.svelte';
import type { SupportEmailVerificationResult } from './SupportEmailVerification.svelte';

const response = (
  email: string,
  status: 'pending' | 'verified',
): SupportEmailVerificationResult => ({
  status,
  email,
  expires_at: status === 'pending' ? '2026-08-30T12:10:00.000Z' : null,
});

const meta = {
  title: 'Components/SupportEmailVerification',
  component: SupportEmailVerification,
  parameters: { layout: 'centered' },
  args: {
    email: 'hello@grove.dev',
    onSend: async (email) => response(email, 'pending'),
    onConfirm: async (code) =>
      response('hello@grove.dev', code === '042069' ? 'verified' : 'pending'),
  },
} satisfies Meta<typeof SupportEmailVerification>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {};
export const Verified: Story = { args: { verified: true } };
export const Error: Story = { args: { initialError: 'Verification request failed. Try again.' } };
export const Sending: Story = {
  args: { onSend: () => new Promise<never>(() => {}) },
  play: ({ canvasElement }) => {
    const button = Array.from(canvasElement.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === 'Send verification email',
    );
    button?.click();
  },
};
export const Confirming: Story = {
  args: { onConfirm: () => new Promise<never>(() => {}) },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>(
      'input[autocomplete="one-time-code"]',
    );
    if (!input) return;
    input.value = '042069';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const button = Array.from(canvasElement.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === 'Confirm code',
    );
    button?.click();
  },
};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
