<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import Button from '../../components/Button.svelte';
  import { featuredProjects } from '../../fixtures/demo.js';
  import { formatMoney } from '../../fixtures/demo.js';
</script>

<div>
  <PublicNav />
  <main id="main-content">
    <section class="pl-section" style="padding-top: 4rem;">
      <div class="pl-container">
        <h1 class="pl-display" style="font-size: 3rem; max-width: 36rem; margin-bottom: 1rem;">
          Open source thrives with you.
        </h1>
        <p class="pl-page-lead" style="margin-bottom: 2rem;">
          Direct support for the tools you rely on. One-off gifts and memberships with clear fees—no hidden platform balance.
        </p>
        <div class="pl-row" style="margin-bottom: 3rem;">
          <Button variant="primary">Support a project</Button>
          <Button variant="secondary">Explore projects</Button>
        </div>
        <h2 class="pl-display" style="font-size: 1.5rem; margin-bottom: 1rem;">Featured projects</h2>
        <div class="pl-grid-3">
          {#each featuredProjects as project (project.slug)}
            <article class="pl-surface" style="padding: 1.25rem;">
              <div class="pl-row" style="margin-bottom: 0.5rem;">
                <strong>{project.name}</strong>
              </div>
              <p class="pl-muted" style="font-size: 0.875rem; margin-bottom: 0.75rem;">{project.description}</p>
              <p class="pl-mono pl-muted" style="font-size: 0.75rem;">
                {project.stats.supporters} supporters · {formatMoney(project.stats.monthlyRecurringMinor, project.currency)}/mo
              </p>
            </article>
          {/each}
        </div>
        <section style="margin-top: 3rem; padding: 2rem; background: var(--pl-canvas-subtle); border-radius: var(--pl-radius-lg);">
          <h2 class="pl-display" style="font-size: 1.25rem; margin-bottom: 0.75rem;">How support works</h2>
          <div class="pl-grid-3">
            <div>
              <strong>One-off</strong>
              <p class="pl-muted" style="font-size: 0.875rem;">Gift any amount. Optional entitlements for a set period.</p>
            </div>
            <div>
              <strong>Monthly</strong>
              <p class="pl-muted" style="font-size: 0.875rem;">Recurring memberships with cumulative tier rewards.</p>
            </div>
            <div>
              <strong>Annual</strong>
              <p class="pl-muted" style="font-size: 0.875rem;">Commit for a year with explicit annual pricing.</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  </main>
  <PublicFooter />
</div>
