<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import { renderSafeMarkdown } from '@oss-tips/domain/content';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import Badge from '../../components/Badge.svelte';
  import { demoProject, demoPosts, type Post, type Project } from '../../fixtures/demo.js';
  import { formatDate, locale, t } from '../../lib/i18n.js';
  import { primitives } from '../../styles/primitives.stylex.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  export interface Props {
    project?: Project;
    post?: Post;
    posts?: Post[];
    slug?: string;
    followOn?: Record<string, string[]>;
  }

  const defaultPost = demoPosts.find((item) => item.slug === 'infrastructure-goal-update');
  if (!defaultPost) throw new Error('Grove demo post infrastructure-goal-update is missing');

  let {
    project = demoProject,
    post: providedPost,
    posts = demoPosts,
    slug = 'infrastructure-goal-update',
    followOn,
  }: Props = $props();

  const post = $derived(providedPost ?? posts.find((item) => item.slug === slug) ?? defaultPost);
  const displayFollowOn = $derived(followOn ?? {
    'infrastructure-goal-update': [
      t('public.post.infrastructureFollowOn', {}, $locale),
      t('public.post.infrastructureFollowOnSecond', {}, $locale),
    ],
    'grove-1-0': [
      t('public.post.releaseFollowOn', {}, $locale),
      t('public.post.releaseFollowOnSecond', {}, $locale),
    ],
  });
  const containerClass = stylex.attrs(publicStyles.container, publicStyles.reading).class;
</script>

<PublicPageFrame mainClass={stylex.attrs(publicStyles.section).class ?? ''}>
  {#snippet children()}
    <div class={containerClass}>
      <p class={stylex.attrs(publicStyles.small, publicStyles.muted).class}><a class={stylex.attrs(publicStyles.link, primitives.focusRing).class} href="/{project.slug}">{project.name}</a> / {t('public.project.posts', {}, $locale)}</p>
      <Badge label={post.tierVisibility} />
      <h1 class={stylex.attrs(publicStyles.pageTitle).class}>{post.title}</h1>
      <p class={stylex.attrs(publicStyles.small, publicStyles.muted).class}><time datetime={post.publishedAt}>{t('public.post.publishedBy', { date: formatDate(post.publishedAt, $locale), author: post.author }, $locale)}</time></p>
      <article class={stylex.attrs(publicStyles.prose).class}>
        <p>{post.excerpt}</p>
        {@html renderSafeMarkdown(post.body, {
          labels: {
            completedTask: t('editor.completedTask', {}, $locale),
            incompleteTask: t('editor.incompleteTask', {}, $locale),
            openEmbed: (provider) => t('editor.openEmbed', { provider }, $locale),
          },
        })}
        {#each displayFollowOn[post.slug] ?? [] as paragraph (paragraph)}<p>{paragraph}</p>{/each}
      </article>
    </div>
  {/snippet}
</PublicPageFrame>
