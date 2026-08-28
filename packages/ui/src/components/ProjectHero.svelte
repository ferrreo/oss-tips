<script lang="ts">
  import Badge from './Badge.svelte';
  import type { Project } from '../fixtures/demo.js';

  interface Props {
    project: Project;
  }

  let { project }: Props = $props();
</script>

<section class="pl-project-hero">
  <div class="pl-project-hero__identity">
    <div class="pl-project-hero__logo" aria-hidden="true">{project.logoLetter}</div>
    <div>
      <div class="pl-row" style="margin-bottom: 0.5rem;">
        <h1 class="pl-project-hero__name">{project.name}</h1>
        {#if project.verified}
          <Badge variant="forest">Verified</Badge>
        {/if}
      </div>
      <p class="pl-muted" style="max-width: 40rem; margin-bottom: 0.75rem;">{project.description}</p>
      <div class="pl-row pl-mono" style="font-size: 0.875rem;">
        <a href={project.website}>{project.website}</a>
        <span class="pl-muted">·</span>
        <a href="https://{project.repository}">{project.repository}</a>
      </div>
      <div class="pl-row" style="margin-top: 0.75rem; flex-wrap: wrap;">
        {#each project.tags as tag (tag)}
          <Badge>{tag}</Badge>
        {/each}
      </div>
    </div>
  </div>
</section>
