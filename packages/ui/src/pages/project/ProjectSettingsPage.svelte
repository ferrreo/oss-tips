<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';

  let feeMode = $state(demoProject.feeMode);
  let slug = $state(demoProject.slug);
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Settings">
  <div class="pl-stack" style="max-width: 40rem;">
    <TextField label="Project name" value={demoProject.name} />
    <TextField label="Slug" value={slug} help="https://oss.tips/{slug}" />
    <TextField label="Description" value={demoProject.description} />
    <div>
      <span class="pl-field__label">Fee mode</span>
      <SegmentedControl
        options={[
          { value: 'standard', label: 'Standard' },
          { value: 'project_5pct', label: 'Project 5%' },
        ]}
        value={feeMode}
        onchange={(v) => (feeMode = v)}
      />
    </div>
    <Button variant="primary">Save settings</Button>
    <hr class="pl-rule" />
    <Button variant="destructive">Close project</Button>
  </div>
</DashboardShell>
