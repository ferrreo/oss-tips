<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import FeeDisclosure from '../../components/FeeDisclosure.svelte';
  import { demoProject, type Project } from '../../fixtures/demo.js';
  import { formatCurrency, formatDate, locale, t } from '../../lib/i18n.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  export interface Props {
    project?: Project;
    amountMinor?: number;
    tipMinor?: number;
    cadence?: string;
    tier?: string;
    entitlement?: string;
    expires?: string;
    reference?: string;
    receiptEmail?: string;
    paymentStatus?: 'confirmed' | 'processing' | 'failed';
  }

  let {
    project = demoProject,
    amountMinor = 1000,
    tipMinor = 0,
    cadence = 'monthly',
    tier = 'Sapling',
    entitlement = 'Sapling rewards for 30 days',
    expires = '27 Sep 2026',
    reference = '',
    receiptEmail = '',
    paymentStatus = 'processing',
  }: Props = $props();

  const containerClass = stylex.attrs(publicStyles.container, publicStyles.reading).class;
  const cadenceCopy = $derived(
    cadence === 'annual' || cadence === 'yearly'
      ? t('public.cadence.annual', {}, $locale)
      : cadence === 'one-off' || cadence === 'one_off' || cadence === 'oneoff'
        ? t('public.cadence.oneOff', {}, $locale)
        : t('public.cadence.monthly', {}, $locale),
  );
  const amountLabel = $derived(formatCurrency(amountMinor, project.currency, $locale));
  const expiryLabel = $derived(
    Number.isNaN(Date.parse(expires)) ? expires : formatDate(expires, $locale),
  );
  const statusTitle = $derived(
    paymentStatus === 'confirmed'
      ? t('public.checkout.paymentReceived', {}, $locale)
      : paymentStatus === 'processing'
        ? t('public.checkout.paymentProcessing', {}, $locale)
        : t('public.checkout.paymentAttention', {}, $locale),
  );
  const statusMessage = $derived(
    paymentStatus === 'confirmed'
      ? t('public.checkout.stripeReceived', {}, $locale)
      : paymentStatus === 'processing'
        ? t('public.checkout.stripeConfirming', {}, $locale)
        : t('public.checkout.stripeCouldNotConfirm', {}, $locale),
  );
  const pageTitle = $derived(
    paymentStatus === 'confirmed'
      ? t('public.checkout.thanks', { project: project.name }, $locale)
      : paymentStatus === 'processing'
        ? t('public.checkout.confirming', {}, $locale)
        : t('public.checkout.notCompleted', {}, $locale),
  );
  const paidMessage = $derived(
    t(receiptEmail ? 'public.checkout.paidWithReceipt' : 'public.checkout.paid', {
      amount: amountLabel,
      cadence: cadenceCopy,
      project: project.name,
      ...(receiptEmail ? { email: receiptEmail } : {}),
    }, $locale),
  );
  const processingMessage = $derived(
    reference
      ? `${t('public.checkout.waiting', {}, $locale)} ${t('public.checkout.keepReference', { reference }, $locale)}`
      : t('public.checkout.waiting', {}, $locale),
  );
</script>

<PublicPageFrame mainClass={stylex.attrs(publicStyles.section).class ?? ''}>
  {#snippet children()}
    <div class={containerClass}>
      <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{t('public.checkout.kicker', {}, $locale)}</p>
      <StatusBanner variant={paymentStatus === 'failed' ? 'danger' : 'info'} title={statusTitle} message={statusMessage} />
      <h1 class={stylex.attrs(publicStyles.pageTitle).class}>
        {pageTitle}
      </h1>
      {#if paymentStatus === 'confirmed'}
        <svg
          class={stylex.attrs(publicStyles.successSprout).class ?? ''}
          viewBox="0 0 112 48"
          aria-hidden="true"
        >
          <path class={stylex.attrs(publicStyles.successSproutPath).class ?? ''} d="M56 43 C56 32 56 22 57 10" />
          <path class={stylex.attrs(publicStyles.successSproutPath).class ?? ''} d="M56 27 C45 17 34 18 26 22 C34 30 45 31 56 27 Z" />
          <path class={stylex.attrs(publicStyles.successSproutPath).class ?? ''} d="M57 22 C66 13 78 13 87 17 C79 24 68 27 57 22 Z" />
          <path class={stylex.attrs(publicStyles.successSproutPath).class ?? ''} d="M45 42 C49 46 55 46 60 42" />
          <circle class={stylex.attrs(publicStyles.successSproutSeed).class ?? ''} cx="56" cy="43" r="3" />
        </svg>
        <p class={stylex.attrs(publicStyles.lead).class}>
          {paidMessage}
        </p>
        <dl class={stylex.attrs(publicStyles.meta).class}>
          <div>
            <dt class={stylex.attrs(publicStyles.metaLabel).class}>{t('public.checkout.tier', {}, $locale)}</dt>
            <dd>{tier}</dd>
          </div>
          <div>
            <dt class={stylex.attrs(publicStyles.metaLabel).class}>{t('public.checkout.access', {}, $locale)}</dt>
            <dd>{entitlement} ({t('public.checkout.expires', { date: expiryLabel }, $locale)})</dd>
          </div>
          {#if reference}
            <div>
              <dt class={stylex.attrs(publicStyles.metaLabel).class}>{t('public.checkout.reference', {}, $locale)}</dt>
              <dd class={stylex.attrs(publicStyles.mono, publicStyles.breakAnywhere).class}>{reference}</dd>
            </div>
          {/if}
        </dl>
        <FeeDisclosure projectAmountMinor={amountMinor} tipMinor={tipMinor} cadence={cadence} currency={project.currency} />
      {:else if paymentStatus === 'processing'}
        <p class={stylex.attrs(publicStyles.lead).class}>
          {processingMessage}
        </p>
      {/if}
      <div class={stylex.attrs(publicStyles.row).class}>
        {#if paymentStatus === 'confirmed'}
          <a class={stylex.attrs(publicStyles.action, publicStyles.actionPrimary).class} href="/sign-in">{t('public.checkout.createAccount', {}, $locale)}</a>
        {/if}
        <a class={stylex.attrs(publicStyles.action, publicStyles.actionSecondary).class} href="/{project.slug}">{t('public.checkout.returnTo', { project: project.name }, $locale)}</a>
      </div>
    </div>
  {/snippet}
</PublicPageFrame>
