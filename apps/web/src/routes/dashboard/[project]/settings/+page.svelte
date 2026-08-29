<script lang="ts">
  import { page } from '$app/state';
  import SettingsPage from '@oss-tips/ui/pages/dashboard/SettingsPage.svelte';
</script>

<SettingsPage project={page.params.project} />
