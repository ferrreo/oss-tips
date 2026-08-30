<script lang="ts">
  import { untrack } from 'svelte';
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import ThreadView, { type ThreadAction } from '../../components/ThreadView.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import { demoThreads, demoProject, type Project, type Thread } from '../../fixtures/demo.js';
  import { formatCurrency, formatDate, locale, t } from '../../lib/i18n.js';
  import { publicStyles } from '../../styles/public.stylex.js';
  import type { GuestAccessState } from './GuestClaimPage.svelte';

  export type GuestReplyActionResult =
    | { ok: true; message?: string }
    | { ok: false; message: string };

  export type GuestReplyAction = (
    input: { token: string; reply: string },
  ) => GuestReplyActionResult | void | Promise<GuestReplyActionResult | void>;

  export interface GuestReplyPageProps {
    project?: Pick<Project, 'name' | 'currency'> | null;
    thread?: Thread | null;
    reply?: string;
    token?: string;
    expires?: string;
    status?: 'idle' | 'sent' | 'error' | 'expired' | 'used';
    accessState?: GuestAccessState;
    errorMessage?: string;
    onSendReply?: GuestReplyAction;
    blocked?: boolean;
    reported?: boolean;
    onBlockThread?: ThreadAction;
    onReportThread?: ThreadAction;
  }

  export type Props = GuestReplyPageProps;

  const defaultThread = demoThreads.find((item) => item.id === 't2');
  if (!defaultThread) throw new Error('Grove demo thread t2 is missing');

  let {
    project = demoProject,
    thread = defaultThread,
    reply = $bindable(''),
    token = '',
    expires = '5 Sep 2026',
    status: initialStatus = 'idle',
    accessState: initialAccessState = 'valid',
    errorMessage: initialErrorMessage = '',
    onSendReply,
    blocked = false,
    reported = false,
    onBlockThread,
    onReportThread,
  }: Props = $props();

  let status = $state(untrack(() => initialStatus));
  let accessState = $state(
    untrack(() =>
      initialStatus === 'expired'
        ? 'expired'
        : initialStatus === 'used'
          ? 'used'
          : initialAccessState,
    ),
  );
  let errorMessage = $state(untrack(() => initialErrorMessage));
  let loading = $state(false);
  let localBlocked = $state(false);
  let localReported = $state(false);
  const containerClass = stylex.attrs(publicStyles.container, publicStyles.reading).class;

  const cadenceCopy = $derived(
    thread?.cadence === 'annual' || thread?.cadence === 'yearly'
      ? t('public.cadence.annual', {}, $locale)
      : thread?.cadence === 'one-off' || thread?.cadence === 'one_off' || thread?.cadence === 'oneoff'
        ? t('public.cadence.oneOff', {}, $locale)
        : t('public.cadence.monthly', {}, $locale),
  );
  const amountLabel = $derived(
    project && thread ? formatCurrency(thread.amountMinor, project.currency, $locale) : '',
  );
  const expiryLabel = $derived(
    Number.isNaN(Date.parse(expires)) ? expires : formatDate(expires, $locale),
  );

  const accessBanner = $derived(
    accessState === 'expired'
      ? { variant: 'danger' as const, title: t('public.reply.expiredTitle', {}, $locale), message: t('public.reply.expiredMessage', {}, $locale) }
      : accessState === 'used'
        ? { variant: 'info' as const, title: t('public.reply.usedTitle', {}, $locale), message: t('public.reply.usedMessage', {}, $locale) }
        : accessState === 'invalid'
          ? { variant: 'danger' as const, title: t('public.reply.invalidTitle', {}, $locale), message: t('public.reply.invalidMessage', {}, $locale) }
          : accessState === 'unavailable'
            ? { variant: 'danger' as const, title: t('public.reply.unavailableTitle', {}, $locale), message: t('public.reply.unavailableMessage', {}, $locale) }
            : null,
  );
  const statusTitle = $derived(
    status === 'sent'
      ? t('public.reply.sentTitle', {}, $locale)
      : status === 'error'
        ? t('public.reply.errorTitle', {}, $locale)
        : t('public.reply.linkTitle', {}, $locale),
  );
  const statusMessage = $derived(
    status === 'sent'
      ? t('public.reply.sentMessage', {}, $locale)
      : status === 'error'
        ? errorMessage || t('public.reply.errorMessage', {}, $locale)
        : t('public.reply.linkMessage', { date: expiryLabel }, $locale),
  );
  const busy = $derived(loading);
  const threadBlocked = $derived(blocked || localBlocked);
  const threadReported = $derived(reported || localReported);

  function setError(message: string) {
    status = 'error';
    errorMessage = message;
    loading = false;
  }

  async function sendReply() {
    if (busy) return;
    const nextReply = reply.trim();
    if (!nextReply) {
      setError(t('public.reply.emptyError', {}, $locale));
      return;
    }
    if (nextReply.length > 2000) {
      setError(t('public.reply.tooLongError', {}, $locale));
      return;
    }
    if (/https?:\/\/|www\./i.test(nextReply)) {
      setError(t('public.reply.linksError', {}, $locale));
      return;
    }

    status = 'idle';
    errorMessage = '';
    loading = true;
    try {
      const result = await onSendReply?.({ token, reply: nextReply });
      if (result && !result.ok) {
        setError(result.message);
        return;
      }
      status = 'sent';
    } catch {
      setError(t('auth.sendFailed', {}, $locale));
    } finally {
      loading = false;
    }
  }

  async function blockThread(input: Parameters<ThreadAction>[0]) {
    const result = await onBlockThread?.(input);
    if (!result || result.ok) localBlocked = true;
    return result;
  }

  async function reportThread(input: Parameters<ThreadAction>[0]) {
    const result = await onReportThread?.(input);
    if (!result || result.ok) localReported = true;
    return result;
  }
</script>

<PublicPageFrame mainClass={stylex.attrs(publicStyles.section).class ?? ''}>
  {#snippet children()}
    <div class={containerClass}>
      <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{t('public.reply.kicker', {}, $locale)}</p>
      {#if accessBanner}
        <StatusBanner {...accessBanner} />
      {:else}
        <StatusBanner
          variant={status === 'error' ? 'danger' : 'info'}
          title={statusTitle}
          message={statusMessage}
        />
      {/if}
      <h1 class={stylex.attrs(publicStyles.pageTitle).class}>{project ? t('public.reply.toProject', { project: project.name }, $locale) : t('public.reply.toTeam', {}, $locale)}</h1>
      {#if project && thread}
        <p class={stylex.attrs(publicStyles.lead).class}>
          {t('public.reply.lead', { amount: amountLabel, cadence: cadenceCopy }, $locale)}
        </p>
      {/if}
      {#if project && thread && !accessBanner && status !== 'sent'}
        <div class={stylex.attrs(publicStyles.stack).class}>
          <ThreadView
            thread={thread}
            actor="guest"
            disabled={busy}
            loading={busy}
            showComposer={false}
            blocked={threadBlocked}
            reported={threadReported}
            onBlock={onBlockThread ? blockThread : undefined}
            onReport={onReportThread ? reportThread : undefined}
          />
          {#if !threadBlocked}
            <form onsubmit={(event) => { event.preventDefault(); void sendReply(); }} class={stylex.attrs(publicStyles.stack).class}>
              <TextField
                label={t('public.reply.yourReply', {}, $locale)}
                name="guest-reply"
                bind:value={reply}
                placeholder={t('public.reply.placeholder', {}, $locale)}
                help={t('public.reply.help', {}, $locale)}
                error={status === 'error' ? errorMessage || t('public.reply.emptyError', {}, $locale) : ''}
                required
                disabled={busy}
              />
              <Button variant="primary" type="submit" label={t('public.reply.send', {}, $locale)} loading={busy} disabled={busy} />
            </form>
          {/if}
        </div>
      {/if}
    </div>
  {/snippet}
</PublicPageFrame>
