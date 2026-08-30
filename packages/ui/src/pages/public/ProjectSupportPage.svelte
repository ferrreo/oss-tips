<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import HeroLandscape from '../../components/HeroLandscape.svelte';
  import ProjectHero from '../../components/ProjectHero.svelte';
  import SupportComposer from '../../components/SupportComposer.svelte';
  import type { SupportCheckoutRequest } from '../../components/SupportComposer.svelte';
  import { demoProject, demoTiers, type Project, type Tier } from '../../fixtures/demo.js';
  import { locale, t } from '../../lib/i18n.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  export interface Props {
    project?: Project;
    tiers?: Tier[];
    lead?: string;
    checkoutDisabled?: boolean;
    checkoutLoading?: boolean;
    checkoutError?: string;
    initialDisplayName?: string;
    initialMessage?: string;
    initialReceiptEmail?: string;
    initialShowName?: boolean;
    initialShowAmount?: boolean;
    initialShowMessage?: boolean;
    oncontinue?: ((request: SupportCheckoutRequest) => void | Promise<void>) | undefined;
  }

  let {
    project = demoProject,
    tiers = demoTiers,
    lead,
    checkoutDisabled = false,
    checkoutLoading = false,
    checkoutError = '',
    initialDisplayName = '',
    initialMessage = '',
    initialReceiptEmail = '',
    initialShowName = false,
    initialShowAmount = false,
    initialShowMessage = false,
    oncontinue,
  }: Props = $props();

  const displayLead = $derived(lead ?? t('public.support.lead', {}, $locale));
  const contentClass = stylex.attrs(publicStyles.container, publicStyles.projectContent).class;
</script>

<PublicPageFrame>
  {#snippet children()}
    <HeroLandscape compact />
    <div class={contentClass}>
      <ProjectHero {project} />
      <p class={stylex.attrs(publicStyles.lead).class}>{displayLead}</p>
      <h2 class={stylex.attrs(publicStyles.sectionTitle).class}>{t('public.support.choose', {}, $locale)}</h2>
      <SupportComposer
        {tiers}
        currency={project.currency}
        {...(project.minSupportMinor === undefined
          ? {}
          : { minAmountMinor: project.minSupportMinor })}
        {...(project.maxSupportMinor === undefined
          ? {}
          : { maxAmountMinor: project.maxSupportMinor })}
        disabled={checkoutDisabled}
        loading={checkoutLoading}
        error={checkoutError}
        {initialDisplayName}
        {initialMessage}
        {initialReceiptEmail}
        {initialShowName}
        {initialShowAmount}
        {initialShowMessage}
        {oncontinue}
      />
    </div>
  {/snippet}
</PublicPageFrame>
