<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import Badge from '../../components/Badge.svelte';
  import { demoProject, demoPosts } from '../../fixtures/demo.js';

  const post = demoPosts[0];
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
      <time class="pl-muted" style="font-size: 0.875rem;">{post.publishedAt}</time>
      <article class="pl-prose" style="margin-top: 2rem;">
        <p>{post.excerpt}</p>
        <p>
          Paperlight semantic tokens are now stable across light and dark themes. Components use CSS custom properties
          with the <span class="pl-mono">--pl-*</span> prefix for consistent theming without runtime StyleX.
        </p>
        <p>
          Storybook stories cover every product route so designers and engineers can review full page compositions with
          realistic fixtures before shipping.
        </p>
      </article>
    </div>
  </main>
  <PublicFooter />
</div>
