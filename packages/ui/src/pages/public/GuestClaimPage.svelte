<script lang="ts">
  import { untrack } from 'svelte';
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import { demoProject, type Project } from '../../fixtures/demo.js';
  import { formatCurrency, formatDate, locale, t } from '../../lib/i18n.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  export type GuestAccessState =
    | 'valid'
    | 'pending'
    | 'expired'
    | 'used'
    | 'invalid'
    | 'unavailable';

  export type GuestClaimActionResult =
    | { ok: true; message?: string }
    | { ok: false; message: string };

  export type GuestClaimAction<T> = (
    input: T,
  ) => GuestClaimActionResult | void | Promise<GuestClaimActionResult | void>;

  export interface GuestClaimPageProps {
    project?: Pick<Project, 'name' | 'currency'> | null;
    amountMinor?: number;
    cadence?: string;
    reference?: string;
    expires?: string;
    token?: string;
    email?: string;
    otp?: string;
    step?: 'email' | 'otp';
    status?: 'idle' | 'sent' | 'claimed' | 'error' | 'expired' | 'used';
    accessState?: GuestAccessState;
    errorMessage?: string;
    onRequestCode?: GuestClaimAction<{ token: string; email: string }>;
    onVerifyCode?: GuestClaimAction<{ token: string; email: string; otp: string }>;
  }

  export type Props = GuestClaimPageProps;

  let {
    project = demoProject,
    amountMinor = 5000,
    cadence = 'one-off',
    reference = 'oss_01J8GROVE',
    expires = '5 Sep 2026',
    token = '',
    email = $bindable(''),
    otp = $bindable(''),
    step: initialStep = 'email',
    status: initialStatus = 'idle',
    accessState: initialAccessState = 'valid',
    errorMessage: initialErrorMessage = '',
    onRequestCode,
    onVerifyCode,
  }: Props = $props();

  let status = $state(untrack(() => initialStatus));
  let step = $state(untrack(() => (initialStatus === 'sent' ? 'otp' : initialStep)));
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
  const containerClass = stylex.attrs(publicStyles.container, publicStyles.reading).class;

  const cadenceCopy = $derived(
    cadence === 'annual' || cadence === 'yearly'
      ? t('public.cadence.annual', {}, $locale)
      : cadence === 'one-off' || cadence === 'one_off' || cadence === 'oneoff'
        ? t('public.cadence.oneOff', {}, $locale)
        : t('public.cadence.monthly', {}, $locale),
  );
  const amountLabel = $derived(project ? formatCurrency(amountMinor, project.currency, $locale) : '');
  const expiryLabel = $derived(
    Number.isNaN(Date.parse(expires)) ? expires : formatDate(expires, $locale),
  );

  const accessBanner = $derived(
    accessState === 'expired'
      ? { variant: 'danger' as const, title: t('public.claim.expiredTitle', {}, $locale), message: t('public.claim.expiredMessage', {}, $locale) }
      : accessState === 'used'
        ? { variant: 'info' as const, title: t('public.claim.usedTitle', {}, $locale), message: t('public.claim.usedMessage', {}, $locale) }
        : accessState === 'invalid'
          ? { variant: 'danger' as const, title: t('public.claim.invalidTitle', {}, $locale), message: t('public.claim.invalidMessage', {}, $locale) }
          : accessState === 'unavailable'
            ? { variant: 'danger' as const, title: t('public.claim.unavailableTitle', {}, $locale), message: t('public.claim.unavailableMessage', {}, $locale) }
            : accessState === 'pending'
              ? { variant: 'info' as const, title: t('public.claim.pendingTitle', {}, $locale), message: t('public.claim.pendingMessage', {}, $locale) }
              : null,
  );
  const statusTitle = $derived(
    status === 'claimed'
      ? t('public.claim.claimedTitle', {}, $locale)
      : status === 'sent'
        ? t('public.claim.sentTitle', {}, $locale)
        : status === 'error'
          ? t('public.claim.errorTitle', {}, $locale)
          : t('public.claim.confirmedTitle', {}, $locale),
  );
  const statusMessage = $derived(
    status === 'claimed'
      ? t('public.claim.claimedMessage', {}, $locale)
      : status === 'sent'
        ? t('public.claim.sentMessage', { email }, $locale)
        : status === 'error'
          ? errorMessage || t('public.claim.errorMessage', {}, $locale)
          : t('public.claim.confirmedMessage', {}, $locale),
  );
  const busy = $derived(loading);

  function setError(message: string) {
    status = 'error';
    errorMessage = message;
    loading = false;
  }

  async function requestCode() {
    if (busy) return;
    const nextEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError(t('public.claim.receiptEmailError', {}, $locale));
      return;
    }

    status = 'idle';
    errorMessage = '';
    loading = true;
    try {
      const result = await onRequestCode?.({ token, email: nextEmail });
      if (result && !result.ok) {
        setError(result.message);
        return;
      }
      step = 'otp';
      otp = '';
      status = 'sent';
    } catch {
      setError(t('auth.sendFailed', {}, $locale));
    } finally {
      loading = false;
    }
  }

  async function verifyCode() {
    if (busy) return;
    const nextEmail = email.trim();
    const nextOtp = otp.trim();
    if (!/^\d{6}$/.test(nextOtp)) {
      setError(t('public.claim.codeError', {}, $locale));
      return;
    }

    status = 'sent';
    errorMessage = '';
    loading = true;
    try {
      const result = await onVerifyCode?.({ token, email: nextEmail, otp: nextOtp });
      if (result && !result.ok) {
        setError(result.message);
        return;
      }
      status = 'claimed';
    } catch {
      setError(t('auth.codeFailed', {}, $locale));
    } finally {
      loading = false;
    }
  }

  function resetEmail() {
    if (busy) return;
    step = 'email';
    status = 'idle';
    errorMessage = '';
    otp = '';
  }
</script>

<PublicPageFrame mainClass={stylex.attrs(publicStyles.section).class ?? ''}>
  {#snippet children()}
    <div class={containerClass}>
      <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{t('public.claim.kicker', {}, $locale)}</p>
      {#if accessBanner}
        <StatusBanner {...accessBanner} />
      {:else}
        <StatusBanner
          variant={status === 'error' ? 'danger' : 'info'}
          title={statusTitle}
          message={statusMessage}
        />
      {/if}
      <h1 class={stylex.attrs(publicStyles.pageTitle).class}>{t('public.claim.title', {}, $locale)}</h1>
      {#if project}
        <p class={stylex.attrs(publicStyles.lead).class}>
          {t('public.claim.lead', { amount: amountLabel, cadence: cadenceCopy, project: project.name }, $locale)}
        </p>
        <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>
          {t('public.claim.linkExpires', { reference, date: expiryLabel }, $locale)}
        </p>
      {/if}
      {#if project && !accessBanner && status !== 'claimed'}
        {#if step === 'email'}
          <form class={stylex.attrs(publicStyles.stack).class} onsubmit={(event) => { event.preventDefault(); void requestCode(); }}>
            <TextField
              label={t('public.claim.receiptEmail', {}, $locale)}
              name="receipt-email"
              type="email"
              autocomplete="email"
              bind:value={email}
              help={t('public.claim.receiptEmailHelp', {}, $locale)}
              error={status === 'error' ? errorMessage || t('public.claim.receiptEmailError', {}, $locale) : ''}
              required
              disabled={busy}
            />
            <Button variant="primary" type="submit" label={t('public.claim.sendCode', {}, $locale)} loading={busy} />
          </form>
        {:else}
          <form class={stylex.attrs(publicStyles.stack).class} onsubmit={(event) => { event.preventDefault(); void verifyCode(); }}>
            <TextField
              label={t('public.claim.code', {}, $locale)}
              name="claim-code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              bind:value={otp}
              placeholder={t('public.claim.codePlaceholder', {}, $locale)}
              help={t('public.claim.codeHelp', {}, $locale)}
              error={status === 'error' ? errorMessage || t('public.claim.codeError', {}, $locale) : ''}
              required
              disabled={busy}
            />
            <Button variant="primary" type="submit" label={t('public.claim.support', {}, $locale)} loading={busy} />
            <Button variant="quiet" type="button" label={t('public.claim.differentEmail', {}, $locale)} onclick={resetEmail} disabled={busy} />
          </form>
        {/if}
      {/if}
    </div>
  {/snippet}
</PublicPageFrame>
