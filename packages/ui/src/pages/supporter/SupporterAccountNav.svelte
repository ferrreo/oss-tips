<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import { supporter } from '../../styles/supporter.stylex';
  import { locale, t, type MessageKey } from '../../lib/i18n.js';

  export type SupporterRoute =
    | 'home'
    | 'feed'
    | 'memberships'
    | 'entitlements'
    | 'inbox'
    | 'settings';

  export interface SupporterAccountNavProps {
    current: SupporterRoute;
  }

  let { current }: SupporterAccountNavProps = $props();

  const links: ReadonlyArray<{ id: SupporterRoute; href: string }> = [
    { id: 'home', href: '/me' },
    { id: 'feed', href: '/me/feed' },
    { id: 'memberships', href: '/me/memberships' },
    { id: 'entitlements', href: '/me/entitlements' },
    { id: 'inbox', href: '/me/inbox' },
    { id: 'settings', href: '/me/settings' },
  ];
  const routeKeys: Record<SupporterRoute, MessageKey> = {
    home: 'shells.home',
    feed: 'shells.feed',
    memberships: 'shells.memberships',
    entitlements: 'shells.entitlements',
    inbox: 'shells.inbox',
    settings: 'shells.settings',
  };

  function labelFor(route: SupporterRoute): string {
    return t(routeKeys[route], {}, $locale);
  }

  const navAttrs = stylex.attrs(supporter.accountNav);
  const listAttrs = stylex.attrs(supporter.accountNavList);
</script>

<nav {...navAttrs} aria-label={t('shells.supporterAccount', {}, $locale)}>
  <ul {...listAttrs}>
    {#each links as link (link.id)}
      <li>
        <a
          {...stylex.attrs([supporter.accountLink, current === link.id && supporter.accountLinkActive])}
          href={link.href}
          aria-current={current === link.id ? 'page' : undefined}
        >
          {labelFor(link.id)}
        </a>
      </li>
    {/each}
  </ul>
</nav>
