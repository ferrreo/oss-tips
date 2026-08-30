<script lang="ts">
  import { untrack } from 'svelte';
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import { locale, t } from '../../lib/i18n.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  export interface OAuthProvider {
    id: string;
    label: string;
  }

  export type SignInActionResult =
    | { ok: true }
    | { ok: false; message?: string };
  export type SignInAction<T = string> =
    (value: T) => SignInActionResult | void | Promise<SignInActionResult | void>;

  export interface Props {
    step?: 'email' | 'otp';
    email?: string;
    otp?: string;
    oauth?: OAuthProvider[];
    state?: 'idle' | 'loading' | 'error';
    errorMessage?: string;
    onRequestCode?: SignInAction;
    onVerifyCode?: SignInAction<{ email: string; otp: string }>;
    onOAuth?: SignInAction;
  }

  let {
    step = $bindable('email'),
    email = $bindable(''),
    otp = $bindable(''),
    oauth = [],
    state: initialState = 'idle',
    onRequestCode,
    onVerifyCode,
    onOAuth,
    errorMessage: initialErrorMessage = '',
  }: Props = $props();

  let status = $state(untrack(() => initialState));
  let errorMessage = $state(untrack(() => initialErrorMessage));
  let errorField = $state<'email' | 'otp' | null>(
    untrack(() => initialState === 'error' && !initialErrorMessage ? (step === 'otp' ? 'otp' : 'email') : null),
  );
  let pendingProvider = $state<string | null>(null);
  let pendingAction = $state<'request' | 'verify' | 'oauth' | null>(null);
  const cardClass = stylex.attrs(publicStyles.container, publicStyles.reading, publicStyles.surface).class;

  function setError(message: string, field: 'email' | 'otp' | null = null) {
    status = 'error';
    errorMessage = message;
    errorField = field;
    pendingAction = null;
  }

  async function requestCode() {
    if (isBusy) return;
    const nextEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError(t('auth.validEmail', {}, $locale), 'email');
      return;
    }

    status = 'loading';
    pendingAction = 'request';
    errorMessage = '';
    errorField = null;
    try {
      const result = await onRequestCode?.(nextEmail);
      if (result && !result.ok) {
        setError(result.message ?? t('auth.sendFailed', {}, $locale));
        return;
      }
      step = 'otp';
      otp = '';
      status = 'idle';
      pendingAction = null;
    } catch {
      setError(t('auth.sendFailed', {}, $locale));
    }
  }

  async function verifyCode() {
    if (isBusy) return;
    const nextEmail = email.trim();
    const nextOtp = otp.trim();
    if (!/^\d{6}$/.test(nextOtp)) {
      setError(t('auth.sixDigits', {}, $locale), 'otp');
      return;
    }

    status = 'loading';
    pendingAction = 'verify';
    errorMessage = '';
    errorField = null;
    try {
      const result = await onVerifyCode?.({ email: nextEmail, otp: nextOtp });
      if (result && !result.ok) {
        setError(result.message ?? t('auth.codeFailed', {}, $locale));
        return;
      }
      status = 'idle';
      pendingAction = null;
    } catch {
      setError(t('auth.codeFailed', {}, $locale));
    }
  }

  async function startOAuth(provider: OAuthProvider) {
    if (isBusy) return;
    status = 'loading';
    pendingAction = 'oauth';
    pendingProvider = provider.id;
    errorMessage = '';
    errorField = null;
    try {
      const result = await onOAuth?.(provider.id);
      if (result && !result.ok) {
        setError(result.message ?? t('auth.providerFailed', { provider: provider.id }, $locale));
        return;
      }
      status = 'idle';
    } catch {
      setError(t('auth.providerFailed', { provider: provider.id }, $locale));
    } finally {
      pendingProvider = null;
      pendingAction = null;
    }
  }

  function resetToEmail() {
    step = 'email';
    status = 'idle';
    errorMessage = '';
    errorField = null;
    pendingProvider = null;
    pendingAction = null;
  }

  function handleEmailSubmit(event: SubmitEvent) {
    event.preventDefault();
    void requestCode();
  }

  function handleOtpSubmit(event: SubmitEvent) {
    event.preventDefault();
    void verifyCode();
  }

  const isBusy = $derived(status === 'loading');
  const requestLoading = $derived(
    status === 'loading' && (pendingAction === 'request' || (pendingAction === null && step === 'email')),
  );
  const verifyLoading = $derived(
    status === 'loading' && (pendingAction === 'verify' || (pendingAction === null && step === 'otp')),
  );
  const errorTitle = $derived(
    step === 'otp' ? t('auth.codeNotRecognised', {}, $locale) : t('auth.signInFailed', {}, $locale),
  );
  const visibleErrorMessage = $derived(
    errorMessage || (step === 'otp' ? t('auth.checkInbox', { email: email || t('auth.yourInbox', {}, $locale) }, $locale) : t('auth.enterEmail', {}, $locale)),
  );
  const visibleFieldError = $derived(
    errorMessage || (step === 'otp' ? t('auth.sixDigits', {}, $locale) : t('auth.validEmail', {}, $locale)),
  );

  function providerLabel(provider: OAuthProvider): string {
    if (provider.label) return provider.label;
    const name = {
      github: 'GitHub',
      google: 'Google',
      discord: 'Discord',
      gitlab: 'GitLab',
      codeberg: 'Codeberg',
    }[provider.id] ?? provider.id;
    return t('auth.continueWith', { provider: name }, $locale);
  }
</script>

<PublicPageFrame mainClass={stylex.attrs(publicStyles.section).class ?? ''}>
  {#snippet children()}
    <div class={cardClass}>
      <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{t('auth.kicker', {}, $locale)}</p>
      <h1 class={stylex.attrs(publicStyles.pageTitle).class}>{t('auth.title', {}, $locale)}</h1>
      <p class={stylex.attrs(publicStyles.lead, publicStyles.small).class}>{t('auth.lede', {}, $locale)}</p>
      {#if step === 'email'}
        <form class={stylex.attrs(publicStyles.stack).class} onsubmit={handleEmailSubmit}>
          {#if status === 'error'}
            <StatusBanner variant="danger" title={errorTitle} message={visibleErrorMessage} />
          {/if}
          <TextField label={t('auth.email', {}, $locale)} name="email" type="email" autocomplete="email" bind:value={email} placeholder={t('public.auth.emailPlaceholder', {}, $locale)} help={t('auth.emailHelp', {}, $locale)} error={errorField === 'email' ? visibleFieldError : ''} required disabled={isBusy} />
          <Button variant="primary" type="submit" label={t('auth.sendCode', {}, $locale)} loading={requestLoading} />
          {#if oauth.length > 0}
            <p class={stylex.attrs(publicStyles.small, publicStyles.muted).class}>{t('auth.oauthPrompt', {}, $locale)}</p>
            {#each oauth as provider (provider.id)}
              <Button
                variant="secondary"
                type="button"
                label={providerLabel(provider)}
                loading={pendingProvider === provider.id}
                disabled={isBusy}
                onclick={() => void startOAuth(provider)}
              />
            {/each}
          {/if}
        </form>
      {:else}
        <form class={stylex.attrs(publicStyles.stack).class} onsubmit={handleOtpSubmit}>
          <StatusBanner variant={status === 'error' ? 'danger' : 'info'} title={status === 'error' ? errorTitle : t('auth.codeSent', {}, $locale)} message={status === 'error' ? visibleErrorMessage : t('auth.checkInbox', { email: email || t('auth.yourInbox', {}, $locale) }, $locale)} />
          <TextField label={t('auth.otp', {}, $locale)} name="otp" type="text" inputmode="numeric" autocomplete="one-time-code" bind:value={otp} placeholder={t('public.auth.otpPlaceholder', {}, $locale)} help={t('auth.otpHelp', {}, $locale)} error={errorField === 'otp' ? visibleFieldError : ''} required disabled={isBusy} />
          <Button variant="primary" type="submit" label={t('auth.verify', {}, $locale)} loading={verifyLoading} />
          <Button variant="quiet" type="button" label={t('auth.newCode', {}, $locale)} onclick={() => void requestCode()} disabled={isBusy} loading={requestLoading} />
          <Button variant="quiet" type="button" label={t('auth.differentEmail', {}, $locale)} onclick={resetToEmail} disabled={isBusy} />
        </form>
      {/if}
    </div>
  {/snippet}
</PublicPageFrame>
