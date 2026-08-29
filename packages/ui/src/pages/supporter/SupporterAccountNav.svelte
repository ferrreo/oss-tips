<script lang="ts">
  interface Props {
    current: 'home' | 'memberships' | 'entitlements' | 'inbox' | 'settings';
  }

  let { current }: Props = $props();

  const links = [
    { id: 'home', href: '/me', label: 'Home' },
    { id: 'memberships', href: '/me/memberships', label: 'Memberships' },
    { id: 'entitlements', href: '/me/entitlements', label: 'Entitlements' },
    { id: 'inbox', href: '/me/inbox', label: 'Inbox' },
    { id: 'settings', href: '/me/settings', label: 'Settings' },
  ] as const;
</script>

<nav class="acct-nav" aria-label="Supporter account">
  <ul>
    {#each links as link (link.id)}
      <li>
        <a
          href={link.href}
          class:acct-nav__link--active={current === link.id}
          aria-current={current === link.id ? 'page' : undefined}
        >
          {link.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .acct-nav {
    margin: 1.25rem 0 1.75rem;
    border-bottom: 1px solid var(--pl-border);
  }

  .acct-nav ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .acct-nav a {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
    padding: 0 0.75rem;
    color: var(--pl-ink-muted);
    font-weight: 600;
    text-decoration: none;
    border-bottom: 2px solid transparent;
  }

  .acct-nav a:hover {
    color: var(--pl-ink);
    text-decoration: none;
  }

  .acct-nav__link--active {
    color: var(--pl-ink);
    border-bottom-color: var(--pl-forest);
  }
</style>
