<script lang="ts">
  import { untrack } from 'svelte';
  import Button from './Button.svelte';
  import StatusBanner from './StatusBanner.svelte';
  import TextField from './TextField.svelte';
  import { locale, t, type MessageKey } from '../lib/i18n.js';
  import { stylex } from '../styles/stylex-runtime.js';
  import { projectStyles } from '../styles/project.stylex';

  export type SupportEmailVerificationResult = {
    status: 'pending' | 'verified';
    email: string;
    expires_at: string | null;
  };

  export interface Props {
    email?: string | undefined;
    showEmailField?: boolean | undefined;
    verified?: boolean | undefined;
    initialError?: string | undefined;
    onSend?:
      | ((email: string) => SupportEmailVerificationResult | Promise<SupportEmailVerificationResult>)
      | undefined;
    onConfirm?:
      | ((code: string) => SupportEmailVerificationResult | Promise<SupportEmailVerificationResult>)
      | undefined;
  }

  let {
    email = '',
    showEmailField = true,
    verified = false,
    initialError = '',
    onSend,
    onConfirm,
  }: Props = $props();

  let currentEmail = $state(untrack(() => email));
  let status = $state<'pending' | 'verified'>(untrack(() => (verified ? 'verified' : 'pending')));
  let code = $state('');
  let actionState = $state<'idle' | 'sending' | 'confirming'>('idle');
  let actionError = $state(untrack(() => initialError));
  let actionMessage = $state('');
  let previousEmail = untrack(() => email);
  let previousVerified = untrack(() => verified);

  $effect(() => {
    if (email === previousEmail && verified === previousVerified) return;
    currentEmail = email;
    status = verified ? 'verified' : 'pending';
    code = '';
    actionError = '';
    actionMessage = '';
    previousEmail = email;
    previousVerified = verified;
  });

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);

  async function sendVerification() {
    if (!onSend || !currentEmail.trim() || actionState !== 'idle' || status === 'verified') return;
    actionState = 'sending';
    actionError = '';
    actionMessage = '';
    try {
      const result = await onSend(currentEmail.trim().toLowerCase());
      currentEmail = result.email;
      status = result.status;
      code = '';
      actionMessage = tx('project.supportEmailVerification.sent', { email: result.email });
    } catch (error) {
      actionError =
        error instanceof Error ? error.message : tx('project.supportEmailVerification.actionError');
    } finally {
      actionState = 'idle';
    }
  }

  async function confirmVerification() {
    if (!onConfirm || !/^\d{6}$/.test(code) || actionState !== 'idle' || status === 'verified') return;
    actionState = 'confirming';
    actionError = '';
    actionMessage = '';
    try {
      const result = await onConfirm(code);
      currentEmail = result.email;
      status = result.status;
      code = '';
      actionMessage = tx('project.supportEmailVerification.confirmed');
    } catch (error) {
      actionError =
        error instanceof Error ? error.message : tx('project.supportEmailVerification.actionError');
    } finally {
      actionState = 'idle';
    }
  }
</script>

<section
  class={stylex.attrs(
    projectStyles.surface,
    projectStyles.stack,
    projectStyles.formSurface,
    projectStyles.section,
  ).class}
  aria-labelledby="support-email-verification-heading"
>
  <div>
    <h2 id="support-email-verification-heading" class={stylex.attrs(projectStyles.cardHeading).class}>
      {tx('project.supportEmailVerification.heading')}
    </h2>
    <p class={stylex.attrs(projectStyles.body, projectStyles.small, projectStyles.muted).class}>
      {tx('project.supportEmailVerification.body')}
    </p>
  </div>

  {#if status === 'verified'}
    <StatusBanner
      variant="info"
      title={tx('project.supportEmailVerification.verified')}
      message={tx('project.supportEmailVerification.verifiedBody', { email: currentEmail })}
    />
  {:else}
    <StatusBanner
      variant="warning"
      title={tx('project.supportEmailVerification.pending')}
      message={
        actionMessage || tx('project.supportEmailVerification.pendingBody', { email: currentEmail })
      }
    />
    {#if showEmailField}
      <TextField
        label={tx('project.supportEmailVerification.email')}
        value={currentEmail}
        type="email"
        autocomplete="email"
        disabled
      />
    {/if}
    <div class={stylex.attrs(projectStyles.stackTight).class}>
      <Button
        variant="secondary"
        label={
          actionState === 'sending'
            ? tx('project.supportEmailVerification.sending')
            : tx('project.supportEmailVerification.send')
        }
        loading={actionState === 'sending'}
        disabled={!onSend || !currentEmail.trim() || actionState !== 'idle'}
        onclick={() => void sendVerification()}
      />
      <TextField
        label={tx('project.supportEmailVerification.code')}
        help={tx('project.supportEmailVerification.codeHelp')}
        bind:value={code}
        inputmode="numeric"
        autocomplete="one-time-code"
        required
      />
      <Button
        variant="primary"
        label={
          actionState === 'confirming'
            ? tx('project.supportEmailVerification.confirming')
            : tx('project.supportEmailVerification.confirm')
        }
        loading={actionState === 'confirming'}
        disabled={!onConfirm || !/^\d{6}$/.test(code) || actionState !== 'idle'}
        onclick={() => void confirmVerification()}
      />
    </div>
  {/if}

  {#if actionError}
    <p class={stylex.attrs(projectStyles.error, projectStyles.body, projectStyles.small).class} role="alert">
      {actionError}
    </p>
  {/if}
</section>
