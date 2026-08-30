<script lang="ts">
  import { env } from '$env/dynamic/public';
  import { locale, t } from '@oss-tips/ui/lib/i18n.js';
  import ProjectStripePage from '@oss-tips/ui/pages/project/ProjectStripePage.svelte';

  let { data } = $props();
  let onboardingState = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
  let onboardingError = $state('');

  async function startStripeOnboarding() {
    if (onboardingState === 'loading') return;
    onboardingState = 'loading';
    onboardingError = '';
    try {
      const response = await fetch(
        `/api/v1/projects/${encodeURIComponent(data.project.slug)}/stripe/onboarding-link`,
        {
          method: 'POST',
          headers: { 'idempotency-key': `stripe-onboarding-${crypto.randomUUID()}` },
        },
      );
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw new Error(t('project.stripe.startError', {}, $locale));
      }
      if (
        typeof body !== 'object' ||
        body === null ||
        !('url' in body) ||
        typeof body.url !== 'string'
      ) {
        throw new Error(t('project.stripe.startError', {}, $locale));
      }
      const onboardingUrl = new URL(body.url);
      if (onboardingUrl.protocol !== 'https:' || onboardingUrl.hostname !== 'connect.stripe.com') {
        throw new Error(t('project.stripe.startError', {}, $locale));
      }
      onboardingState = 'success';
      window.location.assign(onboardingUrl.toString());
    } catch {
      onboardingState = 'error';
      onboardingError = t('project.stripe.startError', {}, $locale);
    }
  }
</script>

<ProjectStripePage
  {...data}
  {onboardingState}
  {onboardingError}
  stripePublishableKey={env.PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
  accountSessionEndpoint={`/api/v1/projects/${encodeURIComponent(data.project.slug)}/stripe/account-session`}
  oncontinue={startStripeOnboarding}
/>
