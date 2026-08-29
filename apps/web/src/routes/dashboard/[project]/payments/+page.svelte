<script lang="ts">
  import PaymentsPage from '@oss-tips/ui/pages/dashboard/PaymentsPage.svelte';

  let { data } = $props();
</script>

<PaymentsPage {...data} />
