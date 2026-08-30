<script lang="ts">
  import Badge from './Badge.svelte';
  import type { NavGroup } from '../fixtures/demo.js';
  import { formatSidebarLabel, locale, t } from '../lib/i18n.js';
  import { attrs, shells } from '../styles/shells.stylex.js';

  export interface Props {
    groups: NavGroup[];
    ariaLabel?: string;
    tone?: 'project' | 'admin';
    onNavigate?: () => void;
  }

  let { groups, ariaLabel, tone = 'project', onNavigate }: Props = $props();

  const navAttrs = attrs(shells.sidebarNav);
  const groupAttrs = attrs(shells.sidebarGroup);
  const listAttrs = attrs(shells.sidebarList);
  const displayAriaLabel = $derived(ariaLabel ?? t('common.sidebarNavigation', {}, $locale));
  function linkAttrs(active: boolean) {
    return attrs(
      shells.sidebarLink,
      shells.focus,
      active ? (tone === 'admin' ? shells.sidebarAdminActive : shells.sidebarActive) : null,
    );
  }
</script>

<nav aria-label={displayAriaLabel} class={navAttrs.class} style={navAttrs.style}>
  {#each groups as group (group.label)}
    <div class={groupAttrs.class} style={groupAttrs.style}>{formatSidebarLabel(group.label, $locale)}</div>
    <ul class={listAttrs.class} style={listAttrs.style}>
      {#each group.items as item (item.href)}
        {@const itemLinkAttrs = linkAttrs(Boolean(item.active))}
        <li>
          <a
            href={item.href}
            class={itemLinkAttrs.class}
            style={itemLinkAttrs.style}
            aria-current={item.active ? 'page' : undefined}
            onclick={onNavigate}
          >
            <span>{formatSidebarLabel(item.label, $locale)}</span>
            {#if item.badge}
              <Badge variant="forest">{formatSidebarLabel(String(item.badge), $locale)}</Badge>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {/each}
</nav>
