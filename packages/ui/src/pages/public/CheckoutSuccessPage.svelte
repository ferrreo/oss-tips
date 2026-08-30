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

  const containerClass = stylex.attrs(
    publicStyles.container,
    publicStyles.reading,
    publicStyles.checkoutPage,
  ).class;
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

<PublicPageFrame mainClass={stylex.attrs(publicStyles.section, publicStyles.checkoutMain).class ?? ''}>
  {#snippet children()}
    <div class={containerClass}>
      <header class={stylex.attrs(publicStyles.checkoutHeader).class}>
        <p class={stylex.attrs(publicStyles.mono, publicStyles.muted, publicStyles.checkoutKicker).class}>{t('public.checkout.kicker', {}, $locale)}</p>
        <h1 class={stylex.attrs(publicStyles.pageTitle, publicStyles.checkoutTitle).class}>
          {pageTitle}
        </h1>
      </header>
      <div class={stylex.attrs(publicStyles.checkoutStatus).class}>
        <StatusBanner variant={paymentStatus === 'failed' ? 'danger' : 'info'} title={statusTitle} message={statusMessage} />
      </div>
      {#if paymentStatus === 'confirmed'}
        <div class={stylex.attrs(publicStyles.checkoutSuccess).class}>
          <div class={stylex.attrs(publicStyles.checkoutIntro).class}>
            <svg
              class={stylex.attrs(publicStyles.successFlourish).class ?? ''}
              viewBox="0 0 128 80"
              aria-hidden="true"
            >
              <path class={stylex.attrs(publicStyles.successFlourishStroke).class ?? ''} d="M34 64 C47 70 81 70 94 64" />
              <path class={stylex.attrs(publicStyles.successFlourishStroke).class ?? ''} d="M64 65 C64 54 65 43 67 32" />
              <path class={stylex.attrs(publicStyles.successFlourishLeaf).class ?? ''} d="M65 48 C54 39 44 39 36 44 C43 52 53 54 65 48 Z" />
              <path class={stylex.attrs(publicStyles.successFlourishLeafAccent).class ?? ''} d="M67 39 C76 30 86 30 94 35 C87 43 78 45 67 39 Z" />
              <path class={stylex.attrs(publicStyles.successFlourishSeed).class ?? ''} d="M64 58 C70 59 73 63 71 68 C67 70 62 68 61 64 C60 61 61 59 64 58 Z" />
              <path class={stylex.attrs(publicStyles.successFlourishSeedMark).class ?? ''} d="M64 62 C66 63 67 64 67 66" />
            </svg>
            <p class={stylex.attrs(publicStyles.lead, publicStyles.checkoutLead).class}>
              {paidMessage}
            </p>
          </div>
          <div class={stylex.attrs(publicStyles.checkoutDetails).class}>
            <dl class={stylex.attrs(publicStyles.checkoutMeta).class}>
              <div class={stylex.attrs(publicStyles.checkoutMetaItem).class}>
                <dt class={stylex.attrs(publicStyles.metaLabel).class}>{t('public.checkout.tier', {}, $locale)}</dt>
                <dd class={stylex.attrs(publicStyles.checkoutMetaValue).class}>{tier}</dd>
              </div>
              <div class={stylex.attrs(publicStyles.checkoutMetaItem).class}>
                <dt class={stylex.attrs(publicStyles.metaLabel).class}>{t('public.checkout.access', {}, $locale)}</dt>
                <dd class={stylex.attrs(publicStyles.checkoutMetaValue).class}>{entitlement} ({t('public.checkout.expires', { date: expiryLabel }, $locale)})</dd>
              </div>
              {#if reference}
                <div class={stylex.attrs(publicStyles.checkoutMetaItem).class}>
                  <dt class={stylex.attrs(publicStyles.metaLabel).class}>{t('public.checkout.reference', {}, $locale)}</dt>
                  <dd class={stylex.attrs(publicStyles.mono, publicStyles.breakAnywhere, publicStyles.checkoutMetaValue).class}>{reference}</dd>
                </div>
              {/if}
            </dl>
            <FeeDisclosure headingLevel={2} projectAmountMinor={amountMinor} tipMinor={tipMinor} cadence={cadence} currency={project.currency} />
          </div>
        </div>
      {:else if paymentStatus === 'processing'}
        <p class={stylex.attrs(publicStyles.lead, publicStyles.checkoutPending).class}>
          {processingMessage}
        </p>
      {/if}
      <div class={stylex.attrs(publicStyles.checkoutActions).class}>
        {#if paymentStatus === 'confirmed'}
          <a class={stylex.attrs(publicStyles.action, publicStyles.actionPrimary, publicStyles.checkoutAction).class} href="/sign-in">{t('public.checkout.createAccount', {}, $locale)}</a>
        {/if}
        <a class={stylex.attrs(publicStyles.action, publicStyles.actionSecondary, publicStyles.checkoutAction).class} href="/{project.slug}">{t('public.checkout.returnTo', { project: project.name }, $locale)}</a>
      </div>
    </div>
  {/snippet}
</PublicPageFrame>
