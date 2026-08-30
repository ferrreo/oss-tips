import type { Meta, StoryObj } from '@storybook/svelte-vite';
import StoryMainContext from '../../../.storybook/StoryMainContext.svelte';
import SupporterAccountNav from './SupporterAccountNav.svelte';

const meta = {
  title: 'Pages/Supporter/Account navigation',
  component: SupporterAccountNav,
  args: { current: 'home' },
  parameters: { layout: 'padded' },
  decorators: [() => ({ Component: StoryMainContext })],
} satisfies Meta<typeof SupporterAccountNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Home: Story = Default;
export const Feed: Story = { args: { current: 'feed' } };
export const Memberships: Story = { args: { current: 'memberships' } };
export const Entitlements: Story = { args: { current: 'entitlements' } };
export const Inbox: Story = { args: { current: 'inbox' } };
export const Settings: Story = { args: { current: 'settings' } };
export const Compact: Story = {
  args: { current: 'inbox' },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { args: { current: 'memberships' }, globals: { theme: 'dark' } };
