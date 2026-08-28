<script lang="ts">
  import DashboardShell from '../../components/DashboardShell.svelte';
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import { demoProject, projectNavGroups } from '../../fixtures/demo.js';
</script>

<DashboardShell projectName={demoProject.name} navGroups={projectNavGroups} title="Custom domains">
  <StatusBanner variant="info" title="Custom domain active" message="paperlight.dev serves public pages. Checkout stays on oss.tips." />
  <div class="pl-stack" style="margin-top: 1.5rem; max-width: 36rem;">
    <TextField label="Custom domain" value="paperlight.dev" help="Public pages and posts only." />
    <TextField label="DNS verification" value="_oss-tips.paperlight.dev" help="CNAME or TXT record required." />
    <Button variant="primary">Verify domain</Button>
  </div>
</DashboardShell>
