<script lang="ts">
  import { stylex } from '../styles/stylex-runtime.js';
  import { controls } from '../styles/controls.stylex';
  import { locale, t } from '../lib/i18n.js';

  export interface SegmentedOption {
    value: string;
    label: string;
  }

  export interface Props {
    options: SegmentedOption[];
    value?: string;
    label?: string;
    id?: string;
    disabled?: boolean;
    class?: string;
    onchange?: (value: string) => void;
  }

  let {
    options,
    value = $bindable(''),
    label,
    id,
    disabled = false,
    class: className = '',
    onchange,
  }: Props = $props();

  const componentId = $props.id();
  const generatedGroupId = `${componentId}-group`;
  const groupId = $derived(id ?? generatedGroupId);
  const labelId = $derived(`${groupId}-label`);
  let buttons = $state<HTMLButtonElement[]>([]);

  const groupAttrs = $derived(stylex.attrs(controls.segmented));
  const groupClass = $derived(
    [groupAttrs.class, className].filter(Boolean).join(' '),
  );
  const labelAttrs = $derived(stylex.attrs(controls.fieldLabel));
  const labelClass = $derived(labelAttrs.class ?? '');
  const focusIndex = $derived(
    Math.max(0, options.findIndex((option) => option.value === value)),
  );

  function select(opt: string) {
    value = opt;
    onchange?.(opt);
  }

  function onKeydown(e: KeyboardEvent, index: number) {
    if (!options.length) return;
    const direction = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    const target = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (index + direction + options.length) % options.length;
    if (!direction && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const option = options[target];
    if (!option || disabled) return;
    select(option.value);
    buttons[target]?.focus();
  }
</script>

{#if label}
  <span class={labelClass} style={labelAttrs.style} id={labelId}><bdi>{label}</bdi></span>
{/if}
<div
  class={groupClass}
  style={groupAttrs.style}
  role="group"
  aria-label={label ? undefined : t('common.options', {}, $locale)}
  aria-labelledby={label ? labelId : undefined}
>
  {#each options as opt, i (opt.value)}
    {@const segmentAttrs = stylex.attrs(
      controls.segment,
      value === opt.value ? controls.segmentSelected : null,
      disabled ? controls.segmentDisabled : null,
      controls.focusRing,
    )}
    <button
      type="button"
      id={`${groupId}-${opt.value}`}
      bind:this={buttons[i]}
      class={segmentAttrs.class}
      style={segmentAttrs.style}
      aria-pressed={value === opt.value}
      aria-disabled={disabled ? 'true' : undefined}
      disabled={disabled}
      tabindex={value === opt.value || (!options.some((option) => option.value === value) && i === focusIndex) ? 0 : -1}
      onclick={() => select(opt.value)}
      onkeydown={(e) => onKeydown(e, i)}
    >
      <bdi>{opt.label}</bdi>
    </button>
  {/each}
</div>
