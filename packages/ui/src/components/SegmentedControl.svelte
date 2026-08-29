<script lang="ts">
  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    options: Option[];
    value?: string;
    label?: string;
    onchange?: (value: string) => void;
  }

  let { options, value = $bindable(''), label, onchange }: Props = $props();

  function select(opt: string) {
    value = opt;
    onchange?.(opt);
  }

  function onKeydown(e: KeyboardEvent, index: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = options[(index + 1) % options.length];
      select(next.value);
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = options[(index - 1 + options.length) % options.length];
      select(prev.value);
    }
  }
</script>

{#if label}
  <span class="pl-field__label">{label}</span>
{/if}
<div class="pl-segmented" role="tablist" aria-label={label ?? 'Options'}>
  {#each options as opt, i (opt.value)}
    <button
      type="button"
      role="tab"
      class="pl-segmented__btn pl-focus-ring"
      aria-selected={value === opt.value}
      onclick={() => select(opt.value)}
      onkeydown={(e) => onKeydown(e, i)}
    >
      {opt.label}
    </button>
  {/each}
</div>
