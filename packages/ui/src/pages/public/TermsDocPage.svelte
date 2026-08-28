<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';

  interface Props {
    doc?: string;
  }

  let { doc = 'privacy' }: Props = $props();

  const documents: Record<string, { title: string; sections: { heading: string; body: string }[] }> = {
    privacy: {
      title: 'Privacy policy',
      sections: [
        {
          heading: 'What we collect',
          body: 'Account email, project metadata, payment references from Stripe, and coarse analytics without fingerprinting.',
        },
        {
          heading: 'What we do not sell',
          body: 'oss.tips does not sell personal data or run third-party behavioural advertising.',
        },
        {
          heading: 'Retention',
          body: 'Financial and audit records are retained for the legally required period. OTP codes expire within minutes.',
        },
      ],
    },
    'acceptable-use': {
      title: 'Acceptable use',
      sections: [
        {
          heading: 'Projects',
          body: 'Projects must be open source or accurately describe their openness. Impersonation and malware distribution are prohibited.',
        },
        {
          heading: 'Supporters',
          body: 'Abuse, harassment, and fraudulent payments are prohibited and may lead to account restriction.',
        },
      ],
    },
    refunds: {
      title: 'Refunds and disputes',
      sections: [
        {
          heading: 'Project responsibility',
          body: 'Each project is the merchant of record and sets its refund posture within Stripe and network rules.',
        },
        {
          heading: 'Platform exceptions',
          body: 'oss.tips may issue exceptional refunds for fraud, duplicates, or serious policy violations with an immutable audit reason.',
        },
      ],
    },
    cookies: {
      title: 'Cookie policy',
      sections: [
        {
          heading: 'Essential cookies',
          body: 'Session cookies are required for sign-in and CSRF protection. Theme preference may be stored locally.',
        },
        {
          heading: 'No advertising cookies',
          body: 'We do not use third-party advertising or cross-site tracking cookies.',
        },
      ],
    },
  };

  const content = $derived(documents[doc] ?? {
    title: doc.replace(/-/g, ' '),
    sections: [
      {
        heading: 'Document',
        body: 'This legal document is under review for the public beta. Contact legal@oss.tips for the current draft.',
      },
    ],
  });
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <p class="pl-muted" style="margin-bottom: 0.5rem;">
        <a href="/terms">Terms</a> / {doc}
      </p>
      <h1 class="pl-page-title">{content.title}</h1>
      <p class="pl-muted" style="margin-bottom: 2rem;">Last updated August 2026</p>
      <div class="pl-prose">
        {#each content.sections as section (section.heading)}
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        {/each}
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
