<script lang="ts">
  import { page } from '$app/state';
  import TermsDocPage from '@oss-tips/ui/pages/public/TermsDocPage.svelte';
</script>

<TermsDocPage doc={page.params.doc} />
