<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import SegmentedControl from '../../components/SegmentedControl.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';

  let title = $state('');
  let visibility = $state('public');
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Edit post">
  <div class="pl-stack" style="max-width: 40rem;">
    <TextField label="Title" value={title} placeholder="Post title" />
    <div>
      <span class="pl-field__label">Visibility</span>
      <SegmentedControl
        options={[
          { value: 'public', label: 'Public' },
          { value: 'sapling', label: 'Sapling+' },
          { value: 'canopy', label: 'Canopy' },
        ]}
        value={visibility}
        onchange={(v) => (visibility = v)}
      />
    </div>
    <div class="pl-field">
      <label class="pl-field__label" for="body">Body</label>
      <textarea id="body" class="pl-textarea pl-focus-ring" placeholder="Write your update…"></textarea>
    </div>
    <div class="pl-row">
      <Button variant="primary">Publish</Button>
      <Button variant="secondary">Save draft</Button>
    </div>
  </div>
</DashboardShell>
