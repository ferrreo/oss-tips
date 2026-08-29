<script lang="ts">
  import OnboardingPage from '@oss-tips/ui/pages/dashboard/OnboardingPage.svelte';

  let { data } = $props();
</script>

<OnboardingPage {...data} />
