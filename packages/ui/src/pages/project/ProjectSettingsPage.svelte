<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import Table from '../../components/Table.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
  import { settingsLinks } from './project-demo.js';

  let feeMode = $state(demoProject.feeMode);
  let slug = $state(demoProject.slug);
  let name = $state(demoProject.name);
  let description = $state(demoProject.description);
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Settings">
  <div class="pl-grid-2">
    <div class="pl-stack">
      <TextField label="Project name" bind:value={name} />
      <TextField label="Slug" bind:value={slug} help="https://oss.tips/{slug}" />
      <TextField label="Description" bind:value={description} />
      <TextField label="Website" value={demoProject.website} />
      <TextField label="Repository" value={demoProject.repository} />
      <TextField label="Support email" value="hello@paperlight.dev" />
      <div>
        <span class="pl-field__label">Fee mode</span>
        <SegmentedControl
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'project_5pct', label: 'Project 5%' },
          ]}
          value={feeMode}
          onchange={(v) => {
            if (v === 'standard' || v === 'project_5pct') feeMode = v;
          }}
        />
      </div>
      <Button variant="primary">Save settings</Button>
      <hr class="pl-rule" />
      <Button variant="destructive">Close project</Button>
    </div>
    <div>
      <h2 style="font-size: 1rem; margin-bottom: 0.75rem;">Public links</h2>
      <Table
        caption="Where this project already appears"
        columns={[
          { key: 'label', label: 'Surface' },
          { key: 'value', label: 'Value' },
        ]}
        rows={settingsLinks}
      />
    </div>
  </div>
</DashboardShell>
