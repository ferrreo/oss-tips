import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectPostsPage from './ProjectPostsPage.svelte';
import { demoPosts } from '../../fixtures/demo.js';
import { extraPosts } from './project-demo.js';

const meta = {
  title: 'Pages/ProjectDashboard/Posts',
  component: ProjectPostsPage,
  parameters: { layout: 'fullscreen' },
  args: { posts: [...demoPosts, ...extraPosts] },
} satisfies Meta<typeof ProjectPostsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Empty: Story = { args: { posts: [] } };
export const Error: Story = { args: { pageState: 'error' } };
export const Permission: Story = { args: { pageState: 'permission' } };
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const German: Story = { globals: { locale: 'de' } };
export const RtlSmoke: Story = { globals: { locale: 'fr', direction: 'rtl' } };
