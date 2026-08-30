import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SignInPage from './SignInPage.svelte';

const realisticData = {
  step: 'email' as const,
  email: 'ada@grove.dev',
  otp: '',
  oauth: [
    { id: 'github', label: 'Continue with GitHub' },
    { id: 'google', label: 'Continue with Google' },
  ],
  state: 'idle' as const,
};
const meta = {
  title: 'Pages/Public/Sign In',
  component: SignInPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SignInPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const CodeSent: Story = { args: { ...realisticData, step: 'otp' } };
export const InvalidCode: Story = {
  args: { ...realisticData, step: 'otp', otp: '12', state: 'error' },
};
export const SendingCode: Story = {
  args: { ...realisticData, state: 'loading' },
};
export const VerifyingCode: Story = {
  args: { ...realisticData, step: 'otp', otp: '381204', state: 'loading' },
};
export const ServiceError: Story = {
  args: {
    ...realisticData,
    state: 'error',
    errorMessage: 'Sign-in service is temporarily unavailable. Try again in a moment.',
  },
};
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const CompactDark: Story = {
  args: { ...realisticData, step: 'otp', email: 'ada@grove.dev', otp: '381204' },
  globals: { theme: 'dark' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const German: Story = {
  args: {
    ...realisticData,
    oauth: [
      { id: 'github', label: '' },
      { id: 'google', label: '' },
    ],
  },
  globals: { locale: 'de' },
};

export const BrazilianPortugueseCodeSent: Story = {
  args: {
    ...realisticData,
    oauth: [
      { id: 'github', label: '' },
      { id: 'google', label: '' },
    ],
    step: 'otp',
  },
  globals: { locale: 'pt-BR' },
};
export const OAuthUnavailable: Story = {
  args: { ...realisticData, oauth: [] },
};
export const ConfiguredProviders: Story = {
  args: {
    ...realisticData,
    oauth: [
      { id: 'gitlab', label: '' },
      { id: 'codeberg', label: '' },
      { id: 'discord', label: '' },
    ],
  },
};
export const LongCopy: Story = {
  args: {
    ...realisticData,
    errorMessage:
      'The sign-in service is taking longer than expected. Check your inbox, then try the six-digit code again when it arrives.',
  },
};
export const RtlLongCopy: Story = {
  args: {
    ...realisticData,
    oauth: [
      { id: 'github', label: '' },
      { id: 'google', label: '' },
    ],
  },
  globals: { locale: 'fr', direction: 'rtl' },
};
