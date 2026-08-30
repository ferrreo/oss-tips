<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Badge from '../../components/Badge.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import ThreadView, { type ThreadAction } from '../../components/ThreadView.svelte';
  import type { Thread } from '../../fixtures/demo.js';
  import { formatCadence, formatCurrency, locale, t } from '../../lib/i18n.js';
  import SupporterPageFrame from './SupporterPageFrame.svelte';
  import { supporterThreads as defaultThreads } from './supporter-demo.js';
  import { supporter } from '../../styles/supporter.stylex';

  export interface SupporterInboxPageProps {
    source?: 'demo' | 'db';
    threads?: Thread[];
    error?: string | undefined;
    blocked?: boolean;
    reported?: boolean;
    onSendReply?: ThreadAction;
    onBlockThread?: ThreadAction;
    onReportThread?: ThreadAction;
  }

  let {
    threads = defaultThreads,
    error,
    blocked = false,
    reported = false,
    onSendReply,
    onBlockThread,
    onReportThread,
  }: SupporterInboxPageProps = $props();

  let selectedId = $state('');
  const selected = $derived(threads.find((thread) => thread.id === selectedId) ?? threads[0] ?? null);
  const layoutAttrs = stylex.attrs(supporter.inboxLayout);
  const listAttrs = stylex.attrs(supporter.inboxList);
  const listItemAttrs = stylex.attrs(supporter.inboxListItem);
  const metaAttrs = stylex.attrs(supporter.inboxMeta);
  const mutedAttrs = stylex.attrs(supporter.muted);
</script>

<SupporterPageFrame
  current="inbox"
  title={t('supporter.inbox.title', {}, $locale)}
  lede={t('supporter.inbox.lede', {}, $locale)}
  {error}
>
  {#if threads.length > 0 && selected}
    <div {...layoutAttrs}>
      <ul {...listAttrs} aria-label={t('supporter.inbox.messagesLabel', {}, $locale)}>
        {#each threads as thread (thread.id)}
          <li {...listItemAttrs}>
            <button
              {...stylex.attrs([supporter.inboxItem, thread.id === selected.id && supporter.inboxItemSelected])}
              type="button"
              aria-current={thread.id === selected.id ? 'true' : undefined}
              aria-label={t('supporter.inbox.threadAria', {
                unread: thread.unread ? t('supporter.inbox.unreadPrefix', {}, $locale) : '',
                subject: thread.subject,
                project: thread.project,
              }, $locale)}
              onclick={() => (selectedId = thread.id)}
            >
              <span {...metaAttrs}>
                <strong>{thread.subject}</strong>
                {#if thread.unread}
                  <Badge variant="forest">{t('supporter.inbox.unread', {}, $locale)}</Badge>
                {/if}
              </span>
              <span {...mutedAttrs}>{thread.project} · {thread.amountMinor > 0 ? formatCurrency(thread.amountMinor, thread.currency ?? 'GBP', $locale) : t('common.notAvailable', {}, $locale)} · {formatCadence(thread.cadence, $locale)}</span>
            </button>
          </li>
        {/each}
      </ul>
      <ThreadView
        thread={selected}
        actor="supporter"
        blocked={blocked}
        reported={reported}
        onSendReply={onSendReply}
        onBlock={onBlockThread}
        onReport={onReportThread}
      />
    </div>
  {:else}
    <EmptyState headingLevel={2} title={t('supporter.inbox.emptyTitle', {}, $locale)} description={t('supporter.inbox.emptyDescription', {}, $locale)} />
  {/if}
</SupporterPageFrame>
