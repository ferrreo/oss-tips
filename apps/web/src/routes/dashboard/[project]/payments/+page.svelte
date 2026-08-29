<script lang="ts">
  import { page } from '$app/state';
  import PaymentsPage from '@oss-tips/ui/pages/dashboard/PaymentsPage.svelte';
</script>

<PaymentsPage project={page.params.project} />
