import type { Meta, StoryObj } from '@storybook/svelte-vite';
import { createRawSnippet } from 'svelte';
import PublicPageFrame from './PublicPageFrame.svelte';

const storyContent = createRawSnippet(() => ({
  render: () =>
    '<section aria-labelledby="frame-story-title"><h1 id="frame-story-title">A clear home for open source support</h1><p>Help maintainers keep useful tools moving, one project at a time.</p></section>',
}));

const meta = {
  title: 'Pages/Public/Public Page Frame',
  component: PublicPageFrame,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'desktop' },
  },
} satisfies Meta<typeof PublicPageFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: storyContent } };
export const Compact: Story = {
  args: { children: storyContent },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export const Dark: Story = { args: { children: storyContent }, globals: { theme: 'dark' } };
