<script lang="ts">
  import Table from '../../components/Table.svelte';
  import SupporterWall from '../../components/SupporterWall.svelte';
  import TextField from '../../components/TextField.svelte';
  import { demoProject, demoSupporters, formatMoney } from '../../fixtures/demo.js';
  import { labelCadence } from '../../lib/labels.js';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { rankedSupporters } from './project-demo.js';
</script>

<ProjectDashShell title="Supporters" lede="People who pay Grove, public wall first.">
  <div class="pl-surface" style="padding: 1.25rem; margin-bottom: 1.5rem; max-width: 36rem;">
    <TextField label="Search supporters" value="alex" placeholder="Name or amount" />
  </div>
  <SupporterWall supporters={demoSupporters} currency={demoProject.currency} />
  <h2 style="font-size: 1rem; margin: 2rem 0 0.75rem;">Top supporters</h2>
  <Table
    caption="Ranked by lifetime support"
    columns={[
      { key: 'rank', label: 'Rank' },
      { key: 'name', label: 'Name' },
      { key: 'cadence', label: 'Cadence' },
      { key: 'amount', label: 'Amount' },
    ]}
    rows={rankedSupporters.map((supporter) => ({
      rank: String(supporter.rank),
      name: supporter.name,
      cadence: labelCadence(supporter.cadence),
      amount: supporter.amount,
    }))}
  />
  <h2 style="font-size: 1rem; margin: 2rem 0 0.75rem;">All supporters</h2>
  <Table
    caption="Public and private Grove supporters"
    columns={[
      { key: 'name', label: 'Display name' },
      { key: 'cadence', label: 'Cadence' },
      { key: 'amount', label: 'Amount' },
      { key: 'public', label: 'Public' },
    ]}
    rows={demoSupporters.map((supporter) => ({
      name: supporter.displayName,
      cadence: labelCadence(supporter.cadence),
      amount: supporter.amountMinor ? formatMoney(supporter.amountMinor, demoProject.currency) : '—',
      public: supporter.public ? 'Yes' : 'Private',
    }))}
  />
</ProjectDashShell>
