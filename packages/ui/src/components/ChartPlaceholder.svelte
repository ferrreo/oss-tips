<script lang="ts">
  import SupportOverTimeChart from './SupportOverTimeChart.svelte';
  import { demoSeriesForLabel, type ChartSeries } from './chartModel.js';

  interface Props {
    label?: string;
    range?: string;
    series?: ChartSeries[];
    unit?: string;
    class?: string;
  }

  let {
    label = 'Chart',
    range = 'Last 30 days',
    series,
    unit = '',
    class: className = '',
  }: Props = $props();

  const resolved = $derived(series && series.length > 0 ? series : demoSeriesForLabel(label));
</script>

<SupportOverTimeChart {label} {range} series={resolved} {unit} class={className} />
