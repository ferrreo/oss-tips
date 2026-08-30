<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { formatDate, locale, t, type Locale } from '../../lib/i18n.js';
  import SupporterSecurityRow from './SupporterSecurityRow.svelte';
  import type { SupporterSession } from './SupporterSettingsPage.svelte';
  import { supporter } from '../../styles/supporter.stylex';

  export interface SupporterSessionsSectionProps {
    sessions?: SupporterSession[];
    securityState?: 'ready' | 'loading' | 'error';
    securityError?: string | undefined;
    securityAction?: string | null;
    onrevokesession?: ((id: string) => void | Promise<void>) | undefined;
    onrevokeothersessions?: (() => void | Promise<void>) | undefined;
    runSecurityAction: (
      key: string,
      action: (() => void | Promise<void>) | undefined,
    ) => void | Promise<void>;
  }

  let {
    sessions = [],
    securityState = 'ready',
    securityError,
    securityAction = null,
    onrevokesession,
    onrevokeothersessions,
    runSecurityAction,
  }: SupporterSessionsSectionProps = $props();

  const sectionTitleAttrs = stylex.attrs(supporter.sectionTitle);
  const sectionAttrs = stylex.attrs(supporter.securitySection);
  const mutedAttrs = stylex.attrs(supporter.muted);
  const statusAttrs = stylex.attrs(supporter.statusLine);
  const actionsAttrs = stylex.attrs(supporter.actions);
  const securityListAttrs = stylex.attrs(supporter.securityList);
  const securityMetaAttrs = stylex.attrs(supporter.securityMeta);

  function dateLabel(value: string, currentLocale: Locale): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? t('supporter.settings.invalidDate', {}, currentLocale)
      : formatDate(date, currentLocale);
  }
</script>

<section {...sectionAttrs} aria-labelledby="supporter-sessions-title">
  <h2 id="supporter-sessions-title" {...sectionTitleAttrs}>{t('supporter.settings.sessionsTitle', {}, $locale)}</h2>
  <p {...mutedAttrs}>{t('supporter.settings.sessionsDescription', {}, $locale)}</p>
  {#if securityState === 'loading'}
    <p {...statusAttrs} role="status">{t('supporter.settings.loadingSessions', {}, $locale)}</p>
  {:else if securityState === 'error'}
    <p {...statusAttrs} role="alert">{securityError || t('supporter.settings.sessionsError', {}, $locale)}</p>
  {:else if sessions.length === 0}
    <EmptyState title={t('supporter.settings.noSessionsTitle', {}, $locale)} description={t('supporter.settings.noSessionsDescription', {}, $locale)} />
  {:else}
    <ul {...securityListAttrs}>
      {#each sessions as session, index (session.id)}
        <SupporterSecurityRow
          label={session.current ? t('supporter.settings.thisDevice', {}, $locale) : session.userAgent || t('supporter.settings.unknownBrowser', {}, $locale)}
          meta={t('supporter.settings.sessionMeta', { ip: session.ipAddress || t('supporter.settings.ipUnavailable', {}, $locale), lastActive: dateLabel(session.updatedAt, $locale), expires: dateLabel(session.expiresAt, $locale) }, $locale)}
          last={index === sessions.length - 1}
        >
          {#if session.current}
            <span {...securityMetaAttrs}>{t('supporter.settings.currentSession', {}, $locale)}</span>
          {:else}
            <Button
              variant="quiet"
              label={t('supporter.settings.revoke', {}, $locale)}
              aria-label={t('supporter.settings.revokeAria', { session: session.userAgent || t('supporter.settings.unknownBrowser', {}, $locale) }, $locale)}
              loading={securityAction === `session:${session.id}`}
              disabled={securityState !== 'ready' || Boolean(securityAction)}
              onclick={() => runSecurityAction(`session:${session.id}`, () => onrevokesession?.(session.id))}
            />
          {/if}
        </SupporterSecurityRow>
      {/each}
    </ul>
    {#if sessions.some((session) => !session.current)}
      <div {...actionsAttrs}>
        <Button
          variant="secondary"
          label={t('supporter.settings.revokeOthers', {}, $locale)}
          loading={securityAction === 'sessions:others'}
          disabled={securityState !== 'ready' || Boolean(securityAction) || !onrevokeothersessions}
          onclick={() => runSecurityAction('sessions:others', onrevokeothersessions)}
        />
      </div>
    {/if}
  {/if}
</section>
