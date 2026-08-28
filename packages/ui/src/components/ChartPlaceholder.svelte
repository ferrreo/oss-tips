<script lang="ts">
  interface Props {
    label?: string;
    range?: string;
  }

  let { label = 'Chart', range = 'Last 30 days' }: Props = $props();
</script>

<div class="pl-chart" role="img" aria-label="{label} — {range}">
  <span>{label} · {range}</span>
</div>
