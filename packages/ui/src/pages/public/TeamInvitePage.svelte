<!-- Hallmark · page: invite acceptance · tone: calm and direct · StyleX/Paperlight -->
<script lang="ts">
  import { untrack } from 'svelte';
  import { stylex } from '../../styles/stylex-runtime.js';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import { formatDate, locale, t, type MessageKey } from '../../lib/i18n.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  export type TeamInviteState =
    | 'ready'
    | 'signed-out'
    | 'mismatch'
    | 'expired'
    | 'accepted'
    | 'used'
    | 'missing'
    | 'error';

  export type TeamInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

  export interface TeamInviteSummary {
    id: string;
    project: { name: string; slug: string };
    role: string;
    status: TeamInviteStatus;
    expiresAt: string;
  }

  export type TeamInviteActionResult =
    | { ok: true }
    | {
        ok: false;
        state?: Exclude<TeamInviteState, 'ready' | 'accepted'>;
        message?: string;
      };

  export type TeamInviteAction = () =>
    | TeamInviteActionResult
    | void
    | Promise<TeamInviteActionResult | void>;

  export interface TeamInviteSession {
    email: string;
  }

  export interface Props {
    invite?: TeamInviteSummary | null;
    inviteId?: string;
    session?: TeamInviteSession | null;
    state?: TeamInviteState;
    errorMessage?: string;
    onAccept?: TeamInviteAction;
  }

  let {
    invite = null,
    inviteId = '',
    session = null,
    state: initialState = 'ready',
    errorMessage: initialErrorMessage = '',
    onAccept,
  }: Props = $props();

  let inviteState = $state<TeamInviteState>(untrack(() => initialState));
  let errorMessage = $state(untrack(() => initialErrorMessage));
  let loading = $state(false);

  const containerClass = stylex.attrs(publicStyles.container, publicStyles.reading, publicStyles.surface).class;
  const routeInviteId = $derived(invite?.id || inviteId);
  const returnTo = $derived(routeInviteId ? `/invite/${encodeURIComponent(routeInviteId)}` : '/');
  const signInHref = $derived(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  const retryHref = $derived(routeInviteId ? `/invite/${encodeURIComponent(routeInviteId)}` : '/');
  const projectSlug = $derived(invite?.project.slug ?? '');
  const teamHref = $derived(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectSlug)
      ? `/dashboard/${encodeURIComponent(projectSlug)}/team`
      : '',
  );
  const expiryLabel = $derived(
    invite
      ? Number.isNaN(Date.parse(invite.expiresAt))
        ? invite.expiresAt
        : formatDate(invite.expiresAt, $locale)
      : '',
  );

  function roleKey(role: string | undefined): MessageKey {
    switch (role) {
      case 'admin':
        return 'public.teamInvite.roleAdmin';
      case 'finance':
        return 'public.teamInvite.roleFinance';
      case 'editor':
        return 'public.teamInvite.roleEditor';
      case 'community':
        return 'public.teamInvite.roleCommunity';
      case 'analyst':
        return 'public.teamInvite.roleAnalyst';
      default:
        return 'public.teamInvite.roleMember';
    }
  }

  const roleLabel = $derived(t(roleKey(invite?.role), {}, $locale));
  const banner = $derived(
    inviteState === 'ready'
      ? {
          variant: 'info' as const,
          title: t('public.teamInvite.readyTitle', {}, $locale),
          message: t('public.teamInvite.readyMessage', {}, $locale),
        }
      : inviteState === 'signed-out'
        ? {
            variant: 'info' as const,
            title: t('public.teamInvite.signedOutTitle', {}, $locale),
            message: t('public.teamInvite.signedOutMessage', {}, $locale),
          }
        : inviteState === 'mismatch'
          ? {
              variant: 'danger' as const,
              title: t('public.teamInvite.mismatchTitle', {}, $locale),
              message: errorMessage || t('public.teamInvite.mismatchMessage', {}, $locale),
            }
          : inviteState === 'expired'
            ? {
                variant: 'danger' as const,
                title: t('public.teamInvite.expiredTitle', {}, $locale),
                message: t('public.teamInvite.expiredMessage', {}, $locale),
              }
            : inviteState === 'accepted'
              ? {
                  variant: 'info' as const,
                  title: t('public.teamInvite.acceptedTitle', {}, $locale),
                  message: t('public.teamInvite.acceptedMessage', {}, $locale),
                }
              : inviteState === 'used'
                ? {
                    variant: 'info' as const,
                    title: t('public.teamInvite.usedTitle', {}, $locale),
                    message: t('public.teamInvite.usedMessage', {}, $locale),
                  }
                : inviteState === 'missing'
                  ? {
                      variant: 'danger' as const,
                      title: t('public.teamInvite.missingTitle', {}, $locale),
                      message: t('public.teamInvite.missingMessage', {}, $locale),
                    }
                  : {
                      variant: 'danger' as const,
                      title: t('public.teamInvite.errorTitle', {}, $locale),
                      message: errorMessage || t('public.teamInvite.errorMessage', {}, $locale),
                    },
  );
  const heading = $derived(
    inviteState === 'expired'
      ? t('public.teamInvite.expiredTitle', {}, $locale)
      : inviteState === 'accepted'
        ? t('public.teamInvite.acceptedTitle', {}, $locale)
        : inviteState === 'missing'
          ? t('public.teamInvite.missingTitle', {}, $locale)
          : inviteState === 'error'
            ? t('public.teamInvite.errorTitle', {}, $locale)
            : invite
              ? t('public.teamInvite.title', { project: invite.project.name }, $locale)
              : t('public.teamInvite.errorTitle', {}, $locale),
  );

  async function acceptInvite() {
    if (loading || inviteState !== 'ready') return;
    loading = true;
    errorMessage = '';
    try {
      const result = await onAccept?.();
      if (result && !result.ok) {
        inviteState = result.state ?? 'error';
        errorMessage = result.message ?? '';
        return;
      }
      inviteState = 'accepted';
    } catch {
      inviteState = 'error';
      errorMessage = '';
    } finally {
      loading = false;
    }
  }
</script>

<PublicPageFrame mainClass={stylex.attrs(publicStyles.section).class ?? ''}>
  {#snippet children()}
    <div class={containerClass}>
      <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{t('public.teamInvite.kicker', {}, $locale)}</p>
      <StatusBanner {...banner} />
      <h1 class={stylex.attrs(publicStyles.pageTitle).class}>{heading}</h1>
      {#if invite}
        <p class={stylex.attrs(publicStyles.lead).class}>
          {t('public.teamInvite.lead', { project: invite.project.name, role: roleLabel }, $locale)}
        </p>
        <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>
          {t('public.teamInvite.expires', { date: expiryLabel }, $locale)}
        </p>
      {/if}
      {#if session && (inviteState === 'ready' || inviteState === 'mismatch' || inviteState === 'accepted')}
        <p class={stylex.attrs(publicStyles.small, publicStyles.muted).class}>
          {t('public.teamInvite.signedInAs', { email: session.email }, $locale)}
        </p>
      {/if}
      <div class={stylex.attrs(publicStyles.row).class}>
        {#if inviteState === 'ready'}
          <Button variant="primary" label={t('public.teamInvite.accept', {}, $locale)} loading={loading} onclick={() => void acceptInvite()} />
        {:else if inviteState === 'signed-out'}
          <a class={stylex.attrs(publicStyles.action, publicStyles.actionPrimary).class} href={signInHref}>{t('public.teamInvite.signIn', {}, $locale)}</a>
        {:else if inviteState === 'mismatch'}
          <a class={stylex.attrs(publicStyles.action, publicStyles.actionSecondary).class} href={signInHref}>{t('public.teamInvite.switchAccount', {}, $locale)}</a>
        {:else if inviteState === 'accepted' && teamHref}
          <a class={stylex.attrs(publicStyles.action, publicStyles.actionPrimary).class} href={teamHref}>{t('public.teamInvite.openTeam', {}, $locale)}</a>
        {:else if inviteState === 'error'}
          <a class={stylex.attrs(publicStyles.action, publicStyles.actionSecondary).class} href={retryHref}>{t('public.teamInvite.retry', {}, $locale)}</a>
        {:else if inviteState === 'missing'}
          <a class={stylex.attrs(publicStyles.action, publicStyles.actionSecondary).class} href="/">{t('public.teamInvite.backHome', {}, $locale)}</a>
        {/if}
      </div>
    </div>
  {/snippet}
</PublicPageFrame>
