<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import type { Project } from '../fixtures/demo.js';
  import { visuals } from '../styles/visuals.stylex.js';

  export interface Props {
    project: Pick<Project, 'logoLetter' | 'logoUrl' | 'logoAssetId'>;
    size?: 'default' | 'small';
    class?: string;
  }

  let { project, size = 'default', class: className = '' }: Props = $props();
  let logoFailed = $state(false);
  let resolvedLogoUrl = $state('');

  const logoUrl = $derived(project.logoUrl?.trim() || resolvedLogoUrl);
  const rootClass = $derived(
    `${stylex.attrs(visuals.projectLogo, size === 'small' && visuals.projectLogoSmall).class ?? ''} ${className}`.trim(),
  );

  $effect(() => {
    resolvedLogoUrl = '';
    logoFailed = false;
    if (project.logoUrl?.trim() || !project.logoAssetId?.trim() || typeof fetch === 'undefined') return;
    let cancelled = false;
    fetch(`/api/v1/assets/${encodeURIComponent(project.logoAssetId)}?variant=sm`, {
      headers: { accept: 'application/json' },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (!cancelled && typeof payload === 'object' && payload !== null && 'url' in payload && typeof payload.url === 'string') {
          resolvedLogoUrl = payload.url;
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  });
</script>

<div class={rootClass}>
  {#if logoUrl && !logoFailed}
    <img
      class={stylex.attrs(visuals.projectLogoImage).class}
      src={logoUrl}
      alt=""
      width={size === 'small' ? '48' : '64'}
      height={size === 'small' ? '48' : '64'}
      loading="eager"
      decoding="async"
      onerror={() => (logoFailed = true)}
    />
  {:else}
    <span class={stylex.attrs(visuals.projectLogoFallback).class} aria-hidden="true">{project.logoLetter}</span>
  {/if}
</div>
