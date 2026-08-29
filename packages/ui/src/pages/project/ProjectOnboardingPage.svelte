<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import Button from '../../components/Button.svelte';
  import TextField from '../../components/TextField.svelte';
  import Table from '../../components/Table.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import { onboardingSteps } from './project-demo.js';

  let step = $state(2);
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Onboarding">
  <ol style="list-style: none; padding: 0; margin-bottom: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
    {#each ['Identity', 'Ownership', 'Stripe', 'Page & tiers', 'Publish'] as label, i (label)}
      <li class="pl-badge {i + 1 <= step ? 'pl-badge--forest' : ''}">{i + 1}. {label}</li>
    {/each}
  </ol>
  <Table
    caption="Onboarding checklist"
    columns={[
      { key: 'step', label: 'Step' },
      { key: 'label', label: 'Stage' },
      { key: 'detail', label: 'Current value' },
      { key: 'status', label: 'Status' },
    ]}
    rows={onboardingSteps}
  />
  {#if step === 2}
    <StatusBanner
      variant="info"
      title="Verify repository ownership"
      message="Connect GitHub OAuth or complete file challenge."
    />
    <div class="pl-stack" style="margin-top: 1.5rem; max-width: 36rem;">
      <TextField label="Project name" value={demoProject.name} />
      <TextField label="Repository URL" value={demoProject.repository} />
      <TextField label="Challenge file" value=".oss-tips-challenge" help="Commit this file to the default branch." />
      <Button variant="primary" onclick={() => (step = 3)}>Verify ownership</Button>
    </div>
  {:else if step === 3}
    <StatusBanner variant="warning" title="Connect Stripe" message="Required before accepting payments." />
    <div class="pl-stack" style="margin-top: 1.5rem; max-width: 36rem;">
      <TextField label="Stripe account" value="acct_1Paperlight" />
      <TextField label="Country" value="United Kingdom" />
      <Button variant="primary" onclick={() => (step = 4)}>Start Stripe onboarding</Button>
    </div>
  {:else}
    <p class="pl-muted">Complete each step to publish and accept support.</p>
  {/if}
</DashboardShell>
