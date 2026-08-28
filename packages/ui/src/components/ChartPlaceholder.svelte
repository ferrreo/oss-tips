<script lang="ts">
  interface Props {
    label?: string;
    range?: string;
    class?: string;
  }

  let { label = 'Chart', range = 'Last 30 days', class: className = '' }: Props = $props();
</script>

<div class="pl-chart {className}" role="img" aria-label="{label} — {range}">
  <span>{label} · {range}</span>
</div>
