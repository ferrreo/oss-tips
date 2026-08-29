<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import Table from '../../components/Table.svelte';
  import { demoProject, demoPosts, projectNavGroups } from '../../fixtures/demo.js';
  import { extraPosts } from './project-demo.js';

  const draft = demoPosts[0] ?? {
    id: 'p1',
    slug: 'grove-1-0',
    title: 'Grove 1.0 tokens and docs',
    excerpt: 'Semantic colour tokens, typography stacks, and motion defaults are now stable.',
    publishedAt: '2026-08-15',
    tierVisibility: 'Public',
  };
  let title = $state(draft.title);
  let visibility = $state('public');
  let body = $state(
    'Shared colour tokens, type stacks, and motion defaults are stable. This post is public and marks the Grove 1.0 docs release.',
  );
  const recent = [...demoPosts, ...extraPosts];
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Edit post">
  <div class="pl-grid-2">
    <div class="pl-stack">
      <TextField label="Title" bind:value={title} placeholder="Post title" />
      <TextField label="Slug" value={draft.slug} help="https://oss.tips/grove/posts/{draft.slug}" />
      <div>
        <span class="pl-field__label">Visibility</span>
        <SegmentedControl
          options={[
            { value: 'public', label: 'Public' },
            { value: 'sapling', label: 'Sapling+' },
            { value: 'canopy', label: 'Canopy' },
          ]}
          value={visibility}
          onchange={(v) => (visibility = v)}
        />
      </div>
      <div class="pl-field">
        <label class="pl-field__label" for="body">Body</label>
        <textarea id="body" class="pl-textarea pl-focus-ring" bind:value={body}></textarea>
      </div>
      <TextField label="Excerpt" value={draft.excerpt} />
      <div class="pl-row">
        <Button variant="primary">Publish</Button>
        <Button variant="secondary">Save draft</Button>
      </div>
    </div>
    <div>
      <h2 style="font-size: 1rem; margin-bottom: 0.75rem;">Recent posts</h2>
      <Table
        caption="Reuse title or visibility from an earlier post"
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'visibility', label: 'Visibility' },
          { key: 'published', label: 'Published' },
        ]}
        rows={recent.map((post) => ({
          title: post.title,
          visibility: post.tierVisibility,
          published: post.publishedAt,
        }))}
      />
    </div>
  </div>
</DashboardShell>
