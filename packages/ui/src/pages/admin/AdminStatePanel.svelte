<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import Button from '../../components/Button.svelte';
  import type { AdminPageState } from './admin-types.js';
  import { admin } from '../../styles/admin.stylex.js';
  import { locale, t } from '../../lib/i18n.js';

  export interface Props {
    state: Exclude<AdminPageState, 'ready'>;
    title?: string | undefined;
    message?: string | undefined;
    actionLabel?: string | undefined;
    onclick?: (() => void) | undefined;
  }

  let { state, title, message, actionLabel, onclick }: Props = $props();

  const fallback = $derived({
    empty: {
      title: t('shells.adminEmptyTitle', {}, $locale),
      message: t('shells.adminEmptyMessage', {}, $locale),
    },
    error: {
      title: t('shells.adminErrorTitle', {}, $locale),
      message: t('shells.adminErrorMessage', {}, $locale),
    },
    forbidden: {
      title: t('shells.adminForbiddenTitle', {}, $locale),
      message: t('shells.adminForbiddenMessage', {}, $locale),
    },
  }[state]);
</script>

<section {...stylex.attrs(admin.state)} aria-live="polite" role={state === 'error' ? 'alert' : 'status'}>
  <h2 {...stylex.attrs(admin.stateTitle)}>{title ?? fallback.title}</h2>
  <p {...stylex.attrs(admin.stateMessage)}>{message ?? fallback.message}</p>
  {#if actionLabel}
    <Button variant="secondary" label={actionLabel} onclick={() => onclick?.()} />
  {/if}
</section>
