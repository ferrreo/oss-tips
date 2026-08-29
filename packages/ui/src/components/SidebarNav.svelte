<script lang="ts">
  import Badge from './Badge.svelte';
  import type { NavGroup } from '../fixtures/demo.js';

  interface Props {
    groups: NavGroup[];
  }

  let { groups }: Props = $props();
</script>

<nav>
  {#each groups as group (group.label)}
    <div class="pl-sidebar-nav__group">{group.label}</div>
    <ul class="pl-sidebar-nav">
      {#each group.items as item (item.href)}
        <li>
          <a
            href={item.href}
            class="pl-sidebar-nav__link {item.active ? 'pl-sidebar-nav__link--active' : ''}"
            aria-current={item.active ? 'page' : undefined}
          >
            {item.label}
            {#if item.badge}
              <Badge variant="forest">{item.badge}</Badge>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {/each}
</nav>
