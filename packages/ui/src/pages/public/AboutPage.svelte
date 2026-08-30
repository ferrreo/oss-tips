<script lang="ts">
  import { stylex } from '../../styles/stylex-runtime.js';
  import PublicPageFrame from './PublicPageFrame.svelte';
  import { locale, t } from '../../lib/i18n.js';
  import { publicStyles } from '../../styles/public.stylex.js';

  export interface Props {
    lead?: string;
    beliefs?: string[];
    audience?: string;
  }

  let {
    lead,
    beliefs,
    audience,
  }: Props = $props();

  const displayLead = $derived(lead ?? t('about.lead', {}, $locale));
  const displayBeliefs = $derived(
    beliefs ?? [
      t('about.belief.noWallet', {}, $locale),
      t('about.belief.fees', {}, $locale),
      t('about.belief.guest', {}, $locale),
      t('about.belief.memberships', {}, $locale),
      t('about.belief.privacy', {}, $locale),
    ],
  );
  const displayAudience = $derived(audience ?? t('about.audience', {}, $locale));

  const heroClass = stylex.attrs(publicStyles.hero).class;
  const containerClass = stylex.attrs(publicStyles.container, publicStyles.reading).class;
  const sectionClass = stylex.attrs(publicStyles.sectionTight).class;
  const displayClass = stylex.attrs(publicStyles.heroTitle).class;
  const leadClass = stylex.attrs(publicStyles.lead).class;
  const proseClass = stylex.attrs(publicStyles.prose).class;
</script>

<PublicPageFrame>
  {#snippet children()}
    <section class={heroClass}>
      <div class={containerClass}>
        <p class={stylex.attrs(publicStyles.mono, publicStyles.muted).class}>{t('about.kicker', {}, $locale)}</p>
        <h1 class={displayClass}>{t('about.title', {}, $locale)}</h1>
        <p class={leadClass}>{displayLead}</p>
      </div>
    </section>
    <section class={sectionClass}>
      <div class={containerClass}>
        <div class={proseClass}>
          <h2>{t('about.howItWorks', {}, $locale)}</h2>
          <ul>
            {#each displayBeliefs as belief (belief)}
              <li>{belief}</li>
            {/each}
          </ul>
          <h2>{t('about.whoUsesIt', {}, $locale)}</h2>
          <p>{displayAudience}</p>
        </div>
      </div>
    </section>
  {/snippet}
</PublicPageFrame>
