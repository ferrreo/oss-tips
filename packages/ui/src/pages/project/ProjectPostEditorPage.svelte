<script lang="ts">
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import Table from '../../components/Table.svelte';
  import { demoPosts } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { extraPosts } from './project-demo.js';

  const draft = demoPosts[0] ?? {
    id: 'p1',
    slug: 'infrastructure-goal-update',
    title: 'Infrastructure goal: 60% and the second region is scoped',
    excerpt: 'Checkout failover plan, object-storage cutover, and what $45,230 has already bought.',
    publishedAt: '2026-05-28',
    tierVisibility: 'Public',
  };
  let title = $state(draft.title);
  let visibility = $state('public');
  let body = $state(
    'We signed the second-region contract and started the object-storage cutover. The remaining $29,770 funds replica Postgres and a warm checkout failover.',
  );
  const recent = [...demoPosts, ...extraPosts];
</script>

<ProjectDashShell title="Edit post" lede="Write an update for Grove supporters and the public.">
  <div class="pl-grid-2">
    <div class="pl-stack">
      <TextField label="Title" bind:value={title} placeholder="Post title" />
      <TextField label="Slug" value={draft.slug} help="https://oss.tips/grove/posts/{draft.slug}" />
      <div>
        <span class="pl-field__label">Visibility</span>
        <SegmentedControl
          options={[
            { value: 'public', label: 'Public' },
            { value: 'supporter', label: 'Supporter+' },
            { value: 'backer', label: 'Backer+' },
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
        caption="Reuse title or visibility from an earlier Grove post"
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'visibility', label: 'Visibility' },
          { key: 'published', label: 'Published' },
        ]}
        rows={recent.map((post) => ({
          title: post.title,
          visibility: post.tierVisibility,
          published: post.publishedLabel,
        }))}
      />
    </div>
  </div>
</ProjectDashShell>
