import type { Meta, StoryObj } from '@storybook/svelte-vite';
import SupporterFeedPage from './SupporterFeedPage.svelte';
import { supporterFeed } from './supporter-demo.js';

const realisticData = { posts: supporterFeed };

const meta = {
  title: 'Pages/Supporter/Private feed',
  component: SupporterFeedPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SupporterFeedPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const MixedEntitledPosts: Story = Default;
export const Empty: Story = { args: { posts: [] } };
export const Loading: Story = { args: { posts: [], status: 'loading' } };
export const Error: Story = {
  args: { posts: [], status: 'error', error: 'The supporter feed is temporarily unavailable.' },
};
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
