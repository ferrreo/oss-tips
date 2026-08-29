<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import Badge from '../../components/Badge.svelte';
  import { demoProject, demoPosts } from '../../fixtures/demo.js';

  const pageDemo = {
    post: demoPosts.find((item) => item.slug === 'infrastructure-goal-update'),
    followOn: [
      'The remaining work is replica Postgres in the second region and a warm checkout failover. Progress stays before fees so the public number matches the ledger.',
      'Backer credits will land on the cookbook colophon when the documentation goal closes. Public RSS still lists the title and excerpt only.',
    ],
  };

  const post = $derived(pageDemo.post);
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <p class="pl-muted" style="margin-bottom: 0.5rem;">
        <a href="/{demoProject.slug}">{demoProject.name}</a> / Posts
      </p>
      {#if post}
        <Badge>{post.tierVisibility}</Badge>
        <h1 class="pl-page-title" style="margin-top: 0.75rem;">{post.title}</h1>
        <p class="pl-muted" style="font-size: 0.875rem;">
          <time datetime={post.publishedAt}>{post.publishedLabel}</time>
          · {post.author}
        </p>
        <article class="pl-prose" style="margin-top: 2rem;">
          <p>{post.excerpt}</p>
          <p>{post.body}</p>
          {#each pageDemo.followOn as paragraph (paragraph)}
            <p>{paragraph}</p>
          {/each}
        </article>
      {/if}
    </div>
  </main>
  <PublicFooter />
</div>
