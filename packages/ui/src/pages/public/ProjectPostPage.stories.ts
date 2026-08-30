import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProjectPostPage from './ProjectPostPage.svelte';
import { demoPosts, demoProject } from '../../fixtures/demo.js';

const post = demoPosts.find((item) => item.slug === 'infrastructure-goal-update');
const releasePost = demoPosts.find((item) => item.slug === 'grove-1-0');
const gatedPost = demoPosts.find((item) => item.tierVisibility !== 'Public');
if (!post || !releasePost || !gatedPost) throw new Error('Grove demo posts are missing');
const gatedPostSummary = { ...gatedPost, excerpt: '', body: '' };
const realisticData = {
  project: demoProject,
  post,
  posts: demoPosts,
  slug: 'infrastructure-goal-update',
  followOn: {
    'infrastructure-goal-update': [
      'The remaining work is replica Postgres in the second region and a warm checkout failover.',
    ],
    'grove-1-0': ['Light, dark, and contrast themes now share one token set.'],
  },
};
const meta = {
  title: 'Pages/Public/Project Post',
  component: ProjectPostPage,
  args: realisticData,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProjectPostPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ReleaseNotes: Story = {
  args: { ...realisticData, post: releasePost, slug: 'grove-1-0' },
};
export const GatedMetadataOnly: Story = {
  args: {
    ...realisticData,
    post: gatedPostSummary,
    slug: gatedPostSummary.slug,
  },
};
export const Compact: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const Dark: Story = { globals: { theme: 'dark' } };
export const SanitizedMarkdown: Story = {
  args: {
    post: {
      ...post,
      body: '# Release notes\n\n- **Safer links** [read the guide](/docs)\n- <script>alert(1)</script>\n\n```ts\nconst ready = true;\n```',
    },
  },
};
export const German: Story = {
  globals: { locale: 'de' },
};
export const LongCopy: Story = {
  args: {
    ...realisticData,
    followOn: {
      'infrastructure-goal-update': [
        'The remaining infrastructure work needs a longer explanation so readers can understand replication, failover, ledger timing, and what changes after settlement.',
      ],
    },
  },
};
export const RtlLongCopy: Story = {
  globals: { locale: 'es', direction: 'rtl' },
};
