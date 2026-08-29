<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import Badge from '../../components/Badge.svelte';
  import { demoProject, demoPosts } from '../../fixtures/demo.js';

  interface Props {
    slug?: string;
  }

  let { slug = 'infrastructure-goal-update' }: Props = $props();

  function requirePost(postSlug: string) {
    const found = demoPosts.find((item) => item.slug === postSlug);
    if (!found) throw new Error(`Grove demo post missing: ${postSlug}`);
    return found;
  }

  const post = $derived(requirePost(slug));

  const followOn: Record<string, string[]> = {
    'infrastructure-goal-update': [
      'The remaining work is replica Postgres in the second region and a warm checkout failover. Progress stays before fees so the public number matches the ledger.',
      'Backer credits will land on the cookbook colophon when the documentation goal closes. Public RSS still lists the title and excerpt only.',
    ],
    'grove-1-0': [
      'Light, dark, and contrast themes now share one token set. Storybook and production read the same --pl-* properties.',
      'The Grove 1.0 docs cover type, colour, and motion. Later posts will cover the dashboard compositions.',
    ],
  };
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <p class="pl-muted" style="margin-bottom: 0.5rem;">
        <a href="/{demoProject.slug}">{demoProject.name}</a> / Posts
      </p>
      <Badge>{post.tierVisibility}</Badge>
      <h1 class="pl-page-title" style="margin-top: 0.75rem;">{post.title}</h1>
      <p class="pl-muted" style="font-size: 0.875rem;">
        <time datetime={post.publishedAt}>{post.publishedLabel}</time>
        · {post.author}
      </p>
      <article class="pl-prose" style="margin-top: 2rem;">
        <p>{post.excerpt}</p>
        <p>{post.body}</p>
        {#each followOn[slug] ?? [] as paragraph (paragraph)}
          <p>{paragraph}</p>
        {/each}
      </article>
    </div>
  </main>
  <PublicFooter />
</div>
