<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { locale, t } from '@oss-tips/ui';
  import SupporterMembershipsPage from '@oss-tips/ui/pages/supporter/SupporterMembershipsPage.svelte';

  let { data } = $props();
  let portalState = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
  let portalProjectSlug = $state('');
  let portalError = $state('');
  let cancelState = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
  let cancelMembershipId = $state('');
  let cancelError = $state('');
  let tipState = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
  let tipMembershipId = $state('');
  let tipError = $state('');

  async function openBillingPortal(projectSlug: string) {
    if (portalState === 'loading') return;
    portalState = 'loading';
    portalProjectSlug = projectSlug;
    portalError = '';
    try {
      const response = await fetch(
        `/api/v1/me/projects/${encodeURIComponent(projectSlug)}/billing-portal`,
        {
          method: 'POST',
          headers: { 'idempotency-key': `billing-portal-${crypto.randomUUID()}` },
        },
      );
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw new Error(t('supporter.memberships.portalError', {}, $locale));
      }
      if (
        typeof body !== 'object' ||
        body === null ||
        !('url' in body) ||
        typeof body.url !== 'string'
      ) {
        throw new Error(t('supporter.memberships.portalError', {}, $locale));
      }
      const portalUrl = new URL(body.url);
      if (portalUrl.protocol !== 'https:' || portalUrl.hostname !== 'billing.stripe.com') {
        throw new Error(t('supporter.memberships.portalError', {}, $locale));
      }
      portalState = 'success';
      window.location.assign(portalUrl.toString());
    } catch {
      portalState = 'error';
      portalError = t('supporter.memberships.portalError', {}, $locale);
    }
  }

  async function cancelMembership(membershipId: string): Promise<void> {
    if (cancelState === 'loading') return;
    cancelState = 'loading';
    cancelMembershipId = membershipId;
    cancelError = '';
    try {
      const response = await fetch(`/api/v1/me/memberships/${encodeURIComponent(membershipId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cancel_at_period_end: true }),
      });
      await response.json().catch(() => undefined);
      if (!response.ok) {
        throw new Error(t('supporter.memberships.cancelError', {}, $locale));
      }
      await invalidateAll();
      cancelState = 'success';
    } catch {
      cancelState = 'error';
      cancelError = t('supporter.memberships.cancelError', {}, $locale);
    }
  }

  async function updatePlatformTip(membershipId: string, amountMinor: number): Promise<void> {
    if (tipState === 'loading') return;
    const membership = data.memberships.find((item: { id: string }) => item.id === membershipId);
    if (!membership) {
      tipState = 'error';
      tipError = t('supporter.memberships.tipError', {}, $locale);
      return;
    }
    tipState = 'loading';
    tipMembershipId = membershipId;
    tipError = '';
    try {
      const response = await fetch(`/api/v1/me/memberships/${encodeURIComponent(membershipId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `membership-tip-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          platform_tip: { amount: String(amountMinor), currency: membership.currency.toLowerCase() },
        }),
      });
      await response.json().catch(() => undefined);
      if (!response.ok) throw new Error(t('supporter.memberships.tipError', {}, $locale));
      await invalidateAll();
      tipState = 'success';
    } catch {
      tipState = 'error';
      tipError = t('supporter.memberships.tipError', {}, $locale);
    }
  }
</script>

<SupporterMembershipsPage
  {...data}
  {portalState}
  {portalProjectSlug}
  {portalError}
  {cancelState}
  {cancelMembershipId}
  {cancelError}
  {tipState}
  {tipMembershipId}
  {tipError}
  onmanagebilling={openBillingPortal}
  oncancel={cancelMembership}
  onupdatetip={updatePlatformTip}
/>
