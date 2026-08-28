<script lang="ts">
  import PublicNav from '../../components/PublicNav.svelte';
  import PublicFooter from '../../components/PublicFooter.svelte';
  import TextField from '../../components/TextField.svelte';
  import Badge from '../../components/Badge.svelte';
  import { featuredProjects } from '../../fixtures/demo.js';
  import { formatMoney } from '../../fixtures/demo.js';

  let search = $state('');
</script>

<div>
  <PublicNav />
  <main id="main-content" class="pl-section">
    <div class="pl-container">
      <h1 class="pl-page-title">Explore projects</h1>
      <p class="pl-page-lead">Search by name, repository, ecosystem, or tag.</p>
      <div class="pl-grid-2" style="margin: 1.5rem 0;">
        <TextField label="Search" value={search} placeholder="Project name or repository…" type="search" />
        <div class="pl-row" style="flex-wrap: wrap; padding-top: 1.75rem;">
          <Badge>Active goals</Badge>
          <Badge>Recurring support</Badge>
          <Badge>Recently updated</Badge>
        </div>
      </div>
      <div class="pl-stack">
        {#each featuredProjects.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())) as project (project.slug)}
          <article class="pl-surface" style="padding: 1.25rem;">
            <div class="pl-row pl-row--between">
              <div>
                <h2 style="font-size: 1.125rem; margin-bottom: 0.25rem;">{project.name}</h2>
                <p class="pl-muted" style="font-size: 0.875rem;">{project.description}</p>
              </div>
              <div style="text-align: right;">
                <p class="pl-mono" style="font-size: 0.8125rem;">{project.repository}</p>
                <p class="pl-muted" style="font-size: 0.8125rem;">
                  {formatMoney(project.stats.monthlyRecurringMinor, project.currency)}/mo
                </p>
              </div>
            </div>
            <div class="pl-row" style="margin-top: 0.75rem; flex-wrap: wrap;">
              {#each project.tags as tag (tag)}
                <Badge>{tag}</Badge>
              {/each}
            </div>
          </article>
        {/each}
      </div>
    </div>
  </main>
  <PublicFooter />
</div>
