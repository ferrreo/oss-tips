<script lang="ts">
  import TextField from '../../components/TextField.svelte';
  import Button from '../../components/Button.svelte';
  import StatusBanner from '../../components/StatusBanner.svelte';
  import Table from '../../components/Table.svelte';
  import ProjectDashShell from './ProjectDashShell.svelte';
  import { domainRows } from './project-demo.js';
</script>

<ProjectDashShell title="Custom domains" lede="Public Grove pages on grove.dev. Checkout stays on oss.tips.">
  <StatusBanner
    variant="info"
    title="Custom domain active"
    message="grove.dev serves public pages. Checkout stays on oss.tips."
  />
  <div class="pl-stack" style="margin-top: 1.5rem; max-width: 36rem;">
    <TextField label="Custom domain" value="grove.dev" help="Public pages and posts only." />
    <TextField label="DNS verification" value="_oss-tips.grove.dev" help="CNAME or TXT record required." />
    <Button variant="primary">Verify domain</Button>
  </div>
  <h2 style="font-size: 1rem; margin: 2rem 0 0.75rem;">DNS records</h2>
  <Table
    caption="Records we expect at your registrar"
    columns={[
      { key: 'host', label: 'Host' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'target', label: 'Target' },
    ]}
    rows={domainRows}
  />
</ProjectDashShell>
