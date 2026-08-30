<script lang="ts">
  import { renderSafeMarkdown } from '@oss-tips/domain/content';
  import { stylex } from '../../styles/stylex-runtime.js';
  import Badge from '../../components/Badge.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import { formatDate, locale, t } from '../../lib/i18n.js';
  import SupporterPageFrame from './SupporterPageFrame.svelte';
  import { supporterFeed as defaultPosts } from './supporter-demo.js';
  import { primitives } from '../../styles/primitives.stylex';
  import { supporter } from '../../styles/supporter.stylex';

  export interface SupporterFeedAttachment {
    id: string;
    asset_id: string;
    content_type: string;
    content_length: number;
    download_url: string;
  }

  export interface SupporterFeedPost {
    id: string;
    project_id: string;
    project_slug: string;
    project_name: string;
    slug: string;
    title: string;
    published_at: string | null;
    gated: boolean;
    body: string;
    attachments: SupporterFeedAttachment[];
  }

  export interface SupporterFeedPageProps {
    source?: 'demo' | 'db';
    posts?: SupporterFeedPost[];
    status?: 'ready' | 'loading' | 'error';
    error?: string | undefined;
  }

  let {
    posts = defaultPosts,
    status = 'ready',
    error,
  }: SupporterFeedPageProps = $props();

  const listAttrs = stylex.attrs(supporter.feedList);
  const cardAttrs = stylex.attrs(supporter.feedCard);
  const cardHeaderAttrs = stylex.attrs(supporter.feedCardHeader);
  const projectAttrs = stylex.attrs(supporter.feedProject, primitives.focusRing);
  const titleAttrs = stylex.attrs(supporter.feedTitle);
  const metaAttrs = stylex.attrs(supporter.feedMeta);
  const bodyAttrs = stylex.attrs(supporter.feedBody);
  const attachmentsAttrs = stylex.attrs(supporter.feedAttachments);
  const attachmentListAttrs = stylex.attrs(supporter.feedAttachmentList);
  const attachmentAttrs = stylex.attrs(supporter.feedAttachment, primitives.focusRing);

  function dateLabel(value: string | null): string {
    if (!value) return t('common.notAvailable', {}, $locale);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t('common.notAvailable', {}, $locale) : formatDate(date, $locale);
  }

  function bodyHtml(body: string): string {
    return renderSafeMarkdown(body, {
      labels: {
        completedTask: t('editor.completedTask', {}, $locale),
        incompleteTask: t('editor.incompleteTask', {}, $locale),
        openEmbed: (provider) => t('editor.openEmbed', { provider }, $locale),
      },
    });
  }
</script>

<SupporterPageFrame
  current="feed"
  title={t('supporter.feed.title', {}, $locale)}
  lede={t('supporter.feed.lede', {}, $locale)}
  {error}
>
  {#if status === 'loading'}
    <EmptyState
      headingLevel={2}
      title={t('supporter.feed.loadingTitle', {}, $locale)}
      description={t('supporter.feed.loadingDescription', {}, $locale)}
    />
  {:else if status === 'error'}
    <EmptyState
      headingLevel={2}
      title={t('supporter.feed.errorTitle', {}, $locale)}
      description={t('supporter.feed.errorDescription', {}, $locale)}
    />
  {:else if posts.length === 0}
    <EmptyState
      headingLevel={2}
      title={t('supporter.feed.emptyTitle', {}, $locale)}
      description={t('supporter.feed.emptyDescription', {}, $locale)}
    />
  {:else}
    <ul {...listAttrs} aria-label={t('supporter.feed.postsLabel', {}, $locale)}>
      {#each posts as post (post.id)}
        <li>
          <article {...cardAttrs}>
            <header {...cardHeaderAttrs}>
              <div>
                <a {...projectAttrs} href={`/${encodeURIComponent(post.project_slug)}`}>
                  {post.project_name}
                </a>
                <h2 {...titleAttrs}>{post.title}</h2>
                <p {...metaAttrs}>
                  <time datetime={post.published_at ?? undefined}>
                    {t('supporter.feed.published', { date: dateLabel(post.published_at) }, $locale)}
                  </time>
                </p>
              </div>
              <Badge variant={post.gated ? 'ochre' : 'forest'}>
                {t(post.gated ? 'supporter.feed.gated' : 'supporter.feed.public', {}, $locale)}
              </Badge>
            </header>
            <div {...bodyAttrs}>
              {#if post.body}
                {@html bodyHtml(post.body)}
              {:else}
                <p>{t('supporter.feed.noBody', {}, $locale)}</p>
              {/if}
            </div>
            {#if post.attachments.length > 0}
              <footer {...attachmentsAttrs}>
                <h3>{t('supporter.feed.attachments', {}, $locale)}</h3>
                <ul {...attachmentListAttrs}>
                  {#each post.attachments as attachment (attachment.id)}
                    <li>
                      <a {...attachmentAttrs} href={attachment.download_url}>
                        {t('supporter.feed.download', { name: attachment.content_type }, $locale)}
                      </a>
                    </li>
                  {/each}
                </ul>
              </footer>
            {/if}
          </article>
        </li>
      {/each}
    </ul>
  {/if}
</SupporterPageFrame>
