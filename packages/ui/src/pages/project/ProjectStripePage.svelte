<script lang="ts">
  import { onMount } from 'svelte';
  import type { ConnectHTMLElementRecord, StripeConnectInstance } from '@stripe/connect-js';
  import tokens from '@oss-tips/design-tokens/tokens.json';
  import { stylex } from '../../styles/stylex-runtime.js';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import Button from '../../components/Button.svelte';
  import DataCard from '../../components/DataCard.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import Table from '../../components/Table.svelte';
  import type { NavGroup, Project } from '../../fixtures/demo.js';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { stripeCapabilityRows } from './project-demo.js';
  import { projectStyles } from '../../styles/project.stylex';
  import { locale, t, type MessageKey } from '../../lib/i18n.js';

  export interface Props {
    project?: Project;
    navGroups?: NavGroup[];
    capabilities?: typeof stripeCapabilityRows;
    pageState?: 'ready' | 'error' | 'permission';
    onboardingState?: 'idle' | 'loading' | 'success' | 'error';
    onboardingError?: string;
    oncontinue?: () => void | Promise<void>;
    stripeAccountId?: string;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    /** Public Stripe key and account-session endpoint enable embedded Connect. */
    stripePublishableKey?: string;
    accountSessionEndpoint?: string;
    /** Storybook-only preview; prevents Connect.js from loading in mocked stories. */
    connectPreviewState?: 'loading' | 'ready' | 'error';
    connectPreviewError?: string;
  }

  let {
    project = demoProject,
    navGroups = projectNavGroups,
    capabilities = stripeCapabilityRows,
    pageState = 'ready',
    onboardingState = 'idle',
    onboardingError = '',
    oncontinue,
    stripeAccountId,
    chargesEnabled,
    payoutsEnabled,
    stripePublishableKey = '',
    accountSessionEndpoint = '',
    connectPreviewState,
    connectPreviewError = '',
  }: Props = $props();

  type ConnectState = 'idle' | 'loading' | 'ready' | 'error';
  type ThemeName = keyof typeof tokens.colour;
  const { colour, radius, space, typography } = tokens;
  let connectRuntimeState = $state<ConnectState>();
  let connectRuntimeError = $state('');
  let connectState = $derived(connectRuntimeState ?? connectPreviewState ?? 'idle');
  let connectError = $derived(connectRuntimeError || connectPreviewError);
  let onboardingMount = $state<HTMLDivElement>();
  let managementMount = $state<HTMLDivElement>();
  let embeddedConnect = $derived(
    Boolean(connectPreviewState || (stripePublishableKey && accountSessionEndpoint)),
  );

  const stripeAppearance = (theme: ThemeName) => ({
    variables: {
      fontFamily: typography.uiFamily,
      fontSizeBase: typography.scale.md,
      spacingUnit: space['1'],
      borderRadius: radius.md,
      colorPrimary: colour[theme].forest,
      colorBackground: colour[theme].surface,
      colorText: colour[theme].ink,
      colorDanger: colour[theme].danger,
      buttonPrimaryColorBackground: colour[theme].forest,
    },
  });

  const rootTheme = (): ThemeName => {
    if (typeof document === 'undefined') return 'light';
    const root = document.documentElement;
    let savedPreference: string | null = null;
    try {
      savedPreference = root.ownerDocument.defaultView?.localStorage?.getItem('oss-tips-theme') ?? null;
    } catch {
      savedPreference = null;
    }
    if (savedPreference === 'system') {
      return root.ownerDocument.defaultView?.matchMedia?.('(prefers-color-scheme: dark)')?.matches
        ? 'dark'
        : 'light';
    }
    if (root.dataset.theme === 'dark') return 'dark';
    if (root.dataset.theme === 'light') return 'light';
    return root.ownerDocument.defaultView?.matchMedia?.('(prefers-color-scheme: dark)')?.matches
      ? 'dark'
      : 'light';
  };

  const tx = (key: string, values: Record<string, string | number> = {}) =>
    t(key as MessageKey, values, $locale);
  const stripeCapabilityKeys: Record<string, MessageKey> = {
    card_payments: 'project.stripe.capabilityCardPayments' as MessageKey,
    transfers: 'project.stripe.capabilityTransfers' as MessageKey,
    payouts: 'project.stripe.capabilityPayouts' as MessageKey,
    sepa_debit_payments: 'project.stripe.capabilitySepaDebit' as MessageKey,
    link_payments: 'project.stripe.capabilityLinkPayments' as MessageKey,
  };
  const stripeCapabilityLabel = (value: string) => {
    const key = stripeCapabilityKeys[value];
    return key ? tx(key) : value;
  };

  const handleContinue = () => {
    void oncontinue?.();
  };

  onMount(() => {
    if (connectPreviewState || !embeddedConnect || !accountSessionEndpoint || !stripePublishableKey) return;

    let disposed = false;
    let instance: StripeConnectInstance | undefined;
    let onboarding: ConnectHTMLElementRecord['account-onboarding'] | undefined;
    let management: ConnectHTMLElementRecord['account-management'] | undefined;
    let themeObserver: MutationObserver | undefined;
    let mediaQuery: MediaQueryList | undefined;
    let currentTheme = rootTheme();

    const syncAppearance = () => {
      const nextTheme = rootTheme();
      if (!instance || nextTheme === currentTheme) return;
      currentTheme = nextTheme;
      instance.update({ appearance: stripeAppearance(nextTheme) });
    };

    const fetchClientSecret = async (): Promise<string> => {
      let response: Response;
      try {
        response = await fetch(accountSessionEndpoint, {
          method: 'POST',
          headers: { 'idempotency-key': `stripe-connect-${crypto.randomUUID()}` },
        });
      } catch {
        throw new Error(tx('project.stripe.embeddedLoadError'));
      }
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw new Error(tx('project.stripe.embeddedLoadError'));
      }
      if (
        typeof body !== 'object' ||
        body === null ||
        !('client_secret' in body) ||
        typeof body.client_secret !== 'string' ||
        !body.client_secret
      ) {
        throw new Error(tx('project.stripe.verificationSecretError'));
      }
      return body.client_secret;
    };

    const mount = async () => {
      connectRuntimeState = 'loading';
      connectRuntimeError = '';
      try {
        // Use pure entrypoint so importing this page does not inject Stripe's
        // script during SSR or Storybook rendering.
        const { loadConnectAndInitialize } = await import('@stripe/connect-js/pure');
        if (disposed || !onboardingMount || !managementMount) return;
        instance = loadConnectAndInitialize({
          publishableKey: stripePublishableKey,
          fetchClientSecret,
          appearance: stripeAppearance(currentTheme),
        });
        onboarding = instance.create('account-onboarding');
        management = instance.create('account-management');
        onboarding.setOnLoaderStart(() => {
          connectRuntimeState = 'loading';
        });
        onboarding.setOnLoadError(() => {
          connectRuntimeState = 'error';
          connectRuntimeError = tx('project.stripe.embeddedLoadError');
        });
        onboarding.setOnExit(() => {
          connectRuntimeState = 'ready';
        });
        management.setOnLoadError(() => {
          connectRuntimeState = 'error';
          connectRuntimeError = tx('project.stripe.accountSettingsError');
        });
        management.setOnLoaderStart(() => {
          connectRuntimeState = 'loading';
        });
        onboardingMount.replaceChildren(onboarding);
        managementMount.replaceChildren(management);
        const root = document.documentElement;
        themeObserver = typeof MutationObserver === 'function' ? new MutationObserver(syncAppearance) : undefined;
        themeObserver?.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
        mediaQuery = root.ownerDocument.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
        mediaQuery?.addEventListener?.('change', syncAppearance);
        syncAppearance();
        connectRuntimeState = 'ready';
      } catch {
        if (disposed) return;
        connectRuntimeState = 'error';
        connectRuntimeError = tx('project.stripe.embeddedLoadError');
      }
    };

    void mount();

    return () => {
      disposed = true;
      onboarding?.setOnLoadError(undefined);
      onboarding?.setOnLoaderStart(undefined);
      onboarding?.setOnExit(undefined);
      management?.setOnLoadError(undefined);
      management?.setOnLoaderStart(undefined);
      themeObserver?.disconnect();
      mediaQuery?.removeEventListener?.('change', syncAppearance);
      onboarding?.remove();
      management?.remove();
      instance = undefined;
    };
  });
</script>

<ProjectDashShell
  {project}
  {navGroups}
  title={tx('project.stripe.title')}
  lede={tx('project.stripe.lede', { project: project.name })}
>
  {#if pageState === 'error'}
    <div class={stylex.attrs(projectStyles.error).class} role="alert">
      <strong>{tx('project.stripe.loadError')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.stripe.loadErrorBody')}</p>
    </div>
  {:else if pageState === 'permission'}
    <div class={stylex.attrs(projectStyles.permission).class} role="status">
      <strong>{tx('project.stripe.permission')}</strong>
      <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>{tx('project.stripe.permissionBody')}</p>
    </div>
  {:else}
    <StatusBanner
      variant="warning"
      title={tx('project.stripe.identityWarning')}
      message={tx('project.stripe.identityWarningBody')}
    />
    <div class={stylex.attrs(projectStyles.grid3, projectStyles.responsiveGrid3, projectStyles.section).class}>
      <DataCard
        label={tx('project.stripe.charges')}
        value={chargesEnabled === true ? tx('project.stripe.enabled') : tx('project.stripe.restricted')}
      />
      <DataCard
        label={tx('project.stripe.payouts')}
        value={payoutsEnabled === true ? tx('project.stripe.enabled') : tx('project.stripe.restricted')}
        compare={tx('project.stripe.completeVerification')}
      />
      <DataCard label={tx('project.stripe.connectAccount')} value={stripeAccountId ?? '—'} />
    </div>
    {#if onboardingState === 'success'}
      <StatusBanner
        variant="info"
        title={tx('project.stripe.onboardingReady')}
        message={tx('project.stripe.onboardingReadyBody')}
      />
    {:else if onboardingState === 'error'}
      <div class={stylex.attrs(projectStyles.error).class} role="alert">
        <strong>{tx('project.stripe.startError')}</strong>
        <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>
          {onboardingError || tx('project.stripe.tryAgain')}
        </p>
      </div>
    {/if}
    {#if embeddedConnect}
      <section class={stylex.attrs(projectStyles.surface, projectStyles.stack, projectStyles.section).class} aria-labelledby="stripe-embedded-heading">
        <div>
          <h2 id="stripe-embedded-heading" class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.stripe.embeddedHeading')}</h2>
          <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>
            {tx('project.stripe.embeddedBody')}
          </p>
        </div>
        {#if connectState === 'loading'}
          <p class={stylex.attrs(projectStyles.body, projectStyles.small, projectStyles.muted).class} role="status" aria-live="polite">
            {tx('project.stripe.toolsLoading')}
          </p>
        {:else if connectState === 'error'}
          <div class={stylex.attrs(projectStyles.error).class} role="alert">
            <strong>{tx('project.stripe.embeddedError')}</strong>
            <p class={stylex.attrs(projectStyles.body, projectStyles.small).class}>
              {connectError || tx('project.stripe.hostedFallback')}
            </p>
          </div>
        {/if}
        <div>
          <h3 class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.stripe.identity')}</h3>
          {#if connectPreviewState}
            <div class={stylex.attrs(projectStyles.connectPreview).class} aria-label={tx('project.stripe.mockIdentityAria')}>
              <span class={stylex.attrs(projectStyles.connectPreviewKicker).class}>{tx('project.stripe.preview')}</span>
              <p class={stylex.attrs(projectStyles.connectPreviewStatus).class}>
                {connectPreviewState === 'loading'
                  ? tx('project.stripe.previewIdentityLoading')
                  : connectPreviewState === 'error'
                    ? connectPreviewError || tx('project.stripe.previewIdentityError')
                    : tx('project.stripe.previewIdentityReady')}
              </p>
            </div>
          {:else}
            <div bind:this={onboardingMount} class={stylex.attrs(projectStyles.connectMount).class} aria-label={tx('project.stripe.identityAria')}></div>
          {/if}
        </div>
        <div>
          <h3 class={stylex.attrs(projectStyles.cardHeading).class}>{tx('project.stripe.accountDetails')}</h3>
          {#if connectPreviewState}
            <div class={stylex.attrs(projectStyles.connectPreview).class} aria-label={tx('project.stripe.mockAccountAria')}>
              <span class={stylex.attrs(projectStyles.connectPreviewKicker).class}>{tx('project.stripe.preview')}</span>
              <p class={stylex.attrs(projectStyles.connectPreviewStatus).class}>
                {connectPreviewState === 'loading'
                  ? tx('project.stripe.previewAccountLoading')
                  : connectPreviewState === 'error'
                    ? tx('project.stripe.previewAccountError')
                    : tx('project.stripe.previewAccountReady')}
              </p>
            </div>
          {:else}
            <div bind:this={managementMount} class={stylex.attrs(projectStyles.connectMount).class} aria-label={tx('project.stripe.accountDetailsAria')}></div>
          {/if}
        </div>
      </section>
    {/if}
    <Button
      variant={embeddedConnect ? 'secondary' : 'primary'}
      label={embeddedConnect ? tx('project.stripe.openHosted') : onboardingState === 'success' ? tx('project.stripe.startAnother') : tx('project.stripe.continue')}
      loading={onboardingState === 'loading'}
      onclick={handleContinue}
    />
    <p class={stylex.attrs(projectStyles.body, projectStyles.small, projectStyles.section).class}>
      {tx('project.stripe.payoutDetails')}
    </p>
    <h2 class={stylex.attrs(projectStyles.sectionHeading).class}>{tx('project.stripe.capabilities')}</h2>
    {#if capabilities.length > 0}
      <Table
        caption={tx('project.stripe.capabilityCaption')}
        columns={[
          { key: 'capability', label: tx('project.stripe.capability') },
          { key: 'status', label: tx('project.stripe.status') },
          { key: 'detail', label: tx('project.stripe.detail') },
        ]}
        rows={capabilities.map((row) => ({ ...row, capability: stripeCapabilityLabel(row.capability) }))}
      />
    {:else}
      <EmptyState title={tx('project.stripe.emptyTitle')} description={tx('project.stripe.emptyBody')} />
    {/if}
  {/if}
</ProjectDashShell>
