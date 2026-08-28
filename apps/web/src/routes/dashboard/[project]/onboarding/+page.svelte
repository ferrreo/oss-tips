<script lang="ts">
  import { page } from '$app/state';
  import OnboardingPage from '@oss-tips/ui/pages/dashboard/OnboardingPage.svelte';
</script>

<OnboardingPage project={page.params.project} />
