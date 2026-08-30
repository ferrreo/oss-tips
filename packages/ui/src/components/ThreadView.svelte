<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import TextField from './TextField.svelte';
  import Button from './Button.svelte';
  import type { Thread } from '../fixtures/demo.js';
  import { formatCadence, formatDate, locale, t } from '../lib/i18n.js';
  import { funding } from '../styles/funding.stylex.js';

  export interface Props {
    thread: Thread;
    actor?: 'project' | 'supporter' | 'guest';
    disabled?: boolean;
    loading?: boolean;
    error?: string;
    showComposer?: boolean;
    blocked?: boolean;
    reported?: boolean;
    onSendReply?: ThreadAction | undefined;
    onBlock?: ThreadAction | undefined;
    onReport?: ThreadAction | undefined;
  }

  export type ThreadActionResult =
    | { ok: true; message?: string }
    | { ok: false; message: string };

  export type ThreadAction = (input: {
    threadId: string;
    body?: string;
    reason?: string;
  }) => ThreadActionResult | void | Promise<ThreadActionResult | void>;

  let {
    thread,
    actor = 'supporter',
    disabled = false,
    loading = false,
    error,
    showComposer = true,
    blocked = false,
    reported = false,
    onSendReply,
    onBlock,
    onReport,
  }: Props = $props();

  let reply = $state('');
  let reportReason = $state('');
  let reportOpen = $state(false);
  let localBlocked = $state(false);
  let localReported = $state(false);
  let actionLoading = $state<'send' | 'block' | 'report' | null>(null);
  let actionError = $state('');
  const busy = $derived(loading || actionLoading !== null);
  const isBlocked = $derived(blocked || localBlocked);
  const isReported = $derived(reported || localReported);

  function resultError(result: ThreadActionResult | void): string | null {
    return result && !result.ok ? result.message : null;
  }

  async function sendReply(event: SubmitEvent) {
    event.preventDefault();
    if (busy || isBlocked || !onSendReply) return;
    const body = reply.trim();
    if (!body) {
      actionError = t('common.replyEmpty', {}, $locale);
      return;
    }
    if (body.length > 2000) {
      actionError = t('common.replyTooLong', {}, $locale);
      return;
    }
    if (/(?:https?|ftp|javascript|data):|www\./i.test(body)) {
      actionError = t('common.messageLinks', {}, $locale);
      return;
    }
    actionError = '';
    actionLoading = 'send';
    try {
      const result = await onSendReply({ threadId: thread.id, body });
      const failure = resultError(result);
      if (failure) {
        actionError = failure;
        return;
      }
      reply = '';
    } catch {
      actionError = t('common.replyFailed', {}, $locale);
    } finally {
      actionLoading = null;
    }
  }

  async function blockThread() {
    if (busy || isBlocked || !onBlock) return;
    actionError = '';
    actionLoading = 'block';
    try {
      const result = await onBlock({ threadId: thread.id });
      const failure = resultError(result);
      if (failure) {
        actionError = failure;
        return;
      }
      localBlocked = true;
      reportOpen = false;
    } catch {
      actionError = t('common.blockFailed', {}, $locale);
    } finally {
      actionLoading = null;
    }
  }

  async function reportThread(event: SubmitEvent) {
    event.preventDefault();
    if (busy || isReported || !onReport) return;
    const reason = reportReason.trim();
    if (!reason) {
      actionError = t('common.reportReasonEmpty', {}, $locale);
      return;
    }
    if (reason.length > 500 || /(?:https?|ftp|javascript|data):|www\./i.test(reason)) {
      actionError = t('common.reportReasonInvalid', {}, $locale);
      return;
    }
    actionError = '';
    actionLoading = 'report';
    try {
      const result = await onReport({ threadId: thread.id, reason });
      const failure = resultError(result);
      if (failure) {
        actionError = failure;
        return;
      }
      localReported = true;
      reportOpen = false;
      reportReason = '';
    } catch {
      actionError = t('common.reportFailed', {}, $locale);
    } finally {
      actionLoading = null;
    }
  }
</script>

<article
  class={stylex.attrs(funding.thread, busy ? funding.busy : null).class ?? ''}
  aria-busy={busy}
  aria-label={t('common.supportThread', { subject: thread.subject }, $locale)}
>
  <header class={stylex.attrs(funding.threadHeader).class ?? ''}>
    <div class={stylex.attrs(funding.threadHeaderRow).class ?? ''}>
      <strong class={stylex.attrs(funding.threadSubject).class ?? ''}>{thread.subject}</strong>
      <span class={stylex.attrs(funding.threadMeta).class ?? ''}>
        {thread.project} · {formatCadence(thread.cadence, $locale)}
      </span>
    </div>
    {#if onBlock || onReport}
      <div class={stylex.attrs(funding.threadHeaderActions).class ?? ''}>
        {#if onBlock}
          <Button
            variant="quiet"
            label={
              isBlocked
                ? actor === 'project'
                  ? t('common.supporterBlocked', {}, $locale)
                  : t('common.projectTeamBlocked', {}, $locale)
                : actor === 'project'
                  ? t('common.blockSupporter', {}, $locale)
                  : t('common.blockProjectTeam', {}, $locale)
            }
            loading={actionLoading === 'block'}
            disabled={busy || isBlocked}
            onclick={() => void blockThread()}
          />
        {/if}
        {#if onReport}
          <Button
            variant="quiet"
            label={
              isReported
                ? t('common.reportSubmitted', {}, $locale)
                : reportOpen
                  ? t('common.closeReport', {}, $locale)
                  : t('common.reportConversation', {}, $locale)
            }
            disabled={busy || isReported}
            onclick={() => (reportOpen = !reportOpen)}
          />
        {/if}
      </div>
    {/if}
  </header>
  {#each thread.messages as message (message.id)}
    <div class={stylex.attrs(funding.threadMessage, message.internal ? funding.threadMessageInternal : funding.threadMessageSupporter).class ?? ''}>
      <div class={stylex.attrs(funding.threadMessageHead).class ?? ''}>
        <strong class={stylex.attrs(funding.threadAuthor).class ?? ''}>{message.author}</strong>
        <time class={stylex.attrs(funding.threadTime).class ?? ''} datetime={message.timestamp}>{formatDate(message.timestamp, $locale)}</time>
      </div>
      <p class={stylex.attrs(funding.threadBody).class ?? ''}>{message.body}</p>
      {#if message.internal}
        <span class={stylex.attrs(funding.internalBadge).class ?? ''}>{t('common.internalNote', {}, $locale)}</span>
      {/if}
    </div>
  {/each}
  {#if actionError || isBlocked || isReported}
    {#if actionError}
      <p class={stylex.attrs(funding.feedback).class ?? ''} role="alert">{actionError}</p>
    {/if}
    {#if isBlocked}
      <p class={stylex.attrs(funding.threadStatus).class ?? ''} role="status">
        {t('common.blockedThread', {}, $locale)}
      </p>
    {:else if isReported}
      <p class={stylex.attrs(funding.threadStatus).class ?? ''} role="status">
        {t('common.reportedThread', {}, $locale)}
      </p>
    {/if}
  {/if}
  {#if reportOpen && onReport && !isReported && !isBlocked}
    <form class={stylex.attrs(funding.threadReport).class ?? ''} onsubmit={reportThread}>
      <TextField
        label={t('common.reportReasonLabel', {}, $locale)}
        name="thread-report"
        bind:value={reportReason}
        placeholder={t('common.reportReasonPlaceholder', {}, $locale)}
        help={t('common.reportReasonHelp', {}, $locale)}
        disabled={busy}
      />
      <div class={stylex.attrs(funding.threadActions).class ?? ''}>
        <Button variant="destructive" type="submit" label={t('common.submitReport', {}, $locale)} loading={actionLoading === 'report'} disabled={busy} />
      </div>
    </form>
  {/if}
  {#if showComposer && !isBlocked}
    <footer class={stylex.attrs(funding.threadFooter).class ?? ''}>
      <form onsubmit={sendReply}>
        <TextField
          label={t('common.reply', {}, $locale)}
          name="thread-reply"
          bind:value={reply}
          placeholder={t('common.replyPlaceholder', {}, $locale)}
          disabled={disabled || busy}
        />
        {#if error}
          <p class={stylex.attrs(funding.feedback).class ?? ''} role="alert">{error}</p>
        {/if}
        <div class={stylex.attrs(funding.threadActions).class ?? ''}>
          <Button variant="primary" type="submit" label={t('common.sendReply', {}, $locale)} loading={loading || actionLoading === 'send'} disabled={disabled || busy || !reply.trim()} />
        </div>
      </form>
    </footer>
  {/if}
</article>
