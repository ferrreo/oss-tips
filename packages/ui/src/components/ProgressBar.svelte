<script lang="ts">
  interface Props {
    value: number;
    max?: number;
    label?: string;
  }

  let { value, max = 100, label }: Props = $props();

  const percent = Math.min(100, Math.max(0, (value / max) * 100));
</script>

<div
  class="pl-progress"
  role="progressbar"
  aria-valuemin={0}
  aria-valuemax={max}
  aria-valuenow={value}
  aria-label={label}
>
  <div class="pl-progress__bar" style="width: {percent}%"></div>
</div>
