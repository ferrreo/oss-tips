<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { stylex } from '../styles/stylex-runtime.js';
  import { controls } from '../styles/controls.stylex';

  export interface Props {
    label: string;
    id?: string;
    value?: string;
    type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'date';
    inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
    autocomplete?: HTMLInputAttributes['autocomplete'];
    name?: string;
    placeholder?: string;
    help?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    oninput?: (e: Event) => void;
    class?: string;
  }

  let {
    label,
    id,
    value = $bindable(''),
    type = 'text',
    inputmode,
    autocomplete,
    name,
    placeholder,
    help,
    error,
    required = false,
    disabled = false,
    oninput,
    class: className = '',
  }: Props = $props();

  const componentId = $props.id();
  const generatedId = `${componentId}-field`;
  const inputId = $derived(id ?? generatedId);
  const helpId = $derived(`${inputId}-help`);
  const errorId = $derived(`${inputId}-error`);
  const describedBy = $derived(
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined,
  );
  const fieldAttrs = $derived(stylex.attrs(controls.field));
  const labelAttrs = $derived(stylex.attrs(controls.fieldLabel));
  const helpAttrs = $derived(stylex.attrs(controls.fieldHelp));
  const errorAttrs = $derived(stylex.attrs(controls.fieldError));
  const inputAttrs = $derived(
    stylex.attrs(
      controls.input,
      error ? controls.inputError : null,
      controls.focusRing,
      disabled ? controls.inputDisabled : null,
    ),
  );
  const fieldClass = $derived([fieldAttrs.class, className].filter(Boolean).join(' '));
  const labelClass = $derived(labelAttrs.class ?? '');
  const helpClass = $derived(helpAttrs.class ?? '');
  const errorClass = $derived(errorAttrs.class ?? '');
  const inputClass = $derived(inputAttrs.class ?? '');
</script>

<div class={fieldClass} style={fieldAttrs.style}>
  <label class={labelClass} style={labelAttrs.style} for={inputId}>
    <bdi>{label}</bdi>
  </label>
  {#if help}
    <span class={helpClass} style={helpAttrs.style} id={helpId}>
      <bdi>{help}</bdi>
    </span>
  {/if}
  <input
    id={inputId}
    class={inputClass}
    style={inputAttrs.style}
    type={type}
    inputmode={inputmode}
    autocomplete={autocomplete}
    name={name}
    placeholder={placeholder}
    dir="auto"
    value={value}
    required={required}
    disabled={disabled}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={describedBy}
    aria-errormessage={error ? errorId : undefined}
    oninput={(e) => {
      value = (e.currentTarget as HTMLInputElement).value;
      oninput?.(e);
    }}
  />
  <span
    class={errorClass}
    style={errorAttrs.style}
    id={error ? errorId : undefined}
    aria-hidden={error ? undefined : 'true'}
  >
    <bdi>{error ?? ''}</bdi>
  </span>
</div>
