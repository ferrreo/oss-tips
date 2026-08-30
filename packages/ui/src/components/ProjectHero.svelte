<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import Badge from './Badge.svelte';
  import ProjectLogo from './ProjectLogo.svelte';
  import type { Project } from '../fixtures/demo.js';
  import { locale, t } from '../lib/i18n.js';
  import { primitives } from '../styles/primitives.stylex.js';
  import { visuals } from '../styles/visuals.stylex.js';

  export interface Props {
    class?: string;
    project: Project;
  }

  let { class: className = '', project }: Props = $props();

  function repositoryHref(repository: string): string {
    return /^https?:\/\//.test(repository) ? repository : `https://${repository}`;
  }

  const rootClass = $derived(`${stylex.attrs(visuals.projectHero).class ?? ''} ${className}`.trim());
</script>

<section class={rootClass}>
  <div class={stylex.attrs(visuals.projectIdentity).class}>
    <ProjectLogo {project} />
    <div class={stylex.attrs(visuals.projectBody).class}>
      <div class={stylex.attrs(visuals.projectHeading).class}>
        <h1 class={stylex.attrs(visuals.projectName).class}>{project.name}</h1>
        {#if project.verified}
          <Badge variant="forest" label={t('common.verified', {}, $locale)} />
        {/if}
      </div>
      <p class={stylex.attrs(visuals.projectDescription).class}>{project.description}</p>
      <div class={stylex.attrs(visuals.projectLinks).class}>
        {#if project.website}
          <a class={stylex.attrs(visuals.projectLink, primitives.focusRing).class} href={project.website}>{project.website}</a>
        {/if}
        {#if project.website && project.repository}
          <span class={stylex.attrs(visuals.projectLinkSeparator).class} aria-hidden="true">·</span>
        {/if}
        {#if project.repository}
          <a class={stylex.attrs(visuals.projectLink, primitives.focusRing).class} href={repositoryHref(project.repository)}>{project.repository}</a>
        {/if}
      </div>
      <div class={stylex.attrs(visuals.projectTags).class}>
        {#each project.tags as tag (tag)}
          <Badge>{tag}</Badge>
        {/each}
      </div>
    </div>
  </div>
</section>
