<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';

  const pageDemo = {
    lead: 'oss.tips gives open-source projects a calm, transparent place to receive one-off support and recurring memberships. Projects own the relationship. They are the merchant of record. We supply infrastructure, not custody.',
    beliefs: [
      'No hidden platform balance or internal wallet',
      'Fees disclosed before every checkout',
      'Guest-friendly one-off support without forced accounts',
      'Rewards as memberships, not a hidden shop',
      'Privacy by default. Public recognition and amount disclosure are separate opt-ins',
    ],
    brand: [
      {
        heading: 'Paper',
        body: 'Documentation, source, openness, and history. The canvas stays warm so money pages do not feel like a bank statement.',
      },
      {
        heading: 'Forest',
        body: 'Ecosystems, interdependence, and durability. Support is meant to sustain work over years, not spike a launch week.',
      },
      {
        heading: 'Open seed',
        body: 'A contribution entering the commons. The mark stays open on purpose. Growth without enclosure.',
      },
    ],
  };
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container pl-container--reading">
      <p class="about-overline">Paperlight</p>
      <h1 class="pl-page-title">About oss.tips</h1>
      <div class="pl-prose">
        <p>{pageDemo.lead}</p>
        <h2>What we believe</h2>
        <ul>
          {#each pageDemo.beliefs as belief (belief)}
            <li>{belief}</li>
          {/each}
        </ul>
        <h2>Who we serve</h2>
        <p>
          Maintainers who need sustainable funding without becoming shopkeepers. Supporters who want clarity about where
          money goes and what they receive in return.
        </p>
        <h2>The brand idea</h2>
        <p>
          Open source is infrastructure grown and maintained over time. Funding should feel less like a transaction feed
          and more like sustaining a living commons.
        </p>
      </div>
      <div class="about-brand">
        {#each pageDemo.brand as item (item.heading)}
          <article>
            <h3 class="pl-display" style="font-size: 1.125rem; margin-bottom: 0.35rem;">{item.heading}</h3>
            <p class="pl-muted" style="font-size: 0.875rem; margin: 0;">{item.body}</p>
          </article>
        {/each}
      </div>
    </div>
  </main>
  <PublicFooter />
</div>

<style>
  .about-overline {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--pl-ink-muted);
    margin: 0 0 0.75rem;
  }

  .about-brand {
    display: grid;
    gap: 1rem;
    margin-top: 2rem;
  }

  @media (min-width: 44rem) {
    .about-brand {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
