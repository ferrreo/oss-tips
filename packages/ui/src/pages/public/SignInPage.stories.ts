import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SignInPage from './SignInPage.svelte';

const meta: Meta<SignInPage> = {
  title: 'Pages/Public/Sign In',
  component: SignInPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
