<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import { controls } from '../styles/controls.stylex';
  import { locale, t } from '../lib/i18n.js';

  export interface Props {
    value: number;
    max?: number;
    label: string;
    class?: string;
  }

  let { value, max = 100, label, class: className = '' }: Props = $props();

  const safeMax = $derived(Math.max(1, max));
  const clampedValue = $derived(Math.min(safeMax, Math.max(0, value)));
  const percent = $derived((clampedValue / safeMax) * 100);
  const accessibleLabel = $derived(label.trim() || t('common.progress', {}, $locale));
  const progressAttrs = $derived(stylex.attrs(controls.progress));
  const progressBarAttrs = $derived(
    stylex.attrs(controls.progressBar, controls.progressBarScale(percent / 100)),
  );
  const progressClass = $derived(
    [progressAttrs.class, className].filter(Boolean).join(' '),
  );
</script>

<div
  class={progressClass}
  style={progressAttrs.style}
  role="progressbar"
  aria-valuemin={0}
  aria-valuemax={safeMax}
  aria-valuenow={clampedValue}
  aria-label={accessibleLabel}
>
  <div
    class={progressBarAttrs.class}
    style={progressBarAttrs.style}
  ></div>
</div>
