<script lang="ts">
  interface Props {
    label: string;
    value?: string;
    type?: 'text' | 'email' | 'password' | 'number' | 'search';
    name?: string;
    placeholder?: string;
    help?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    oninput?: (e: Event) => void;
  }

  let {
    label,
    value = $bindable(''),
    type = 'text',
    name,
    placeholder,
    help,
    error,
    required = false,
    disabled = false,
    oninput,
  }: Props = $props();
</script>

<div class="pl-field">
  <label class="pl-field__label" for={name ?? label}>{label}</label>
  {#if help && !error}
    <span class="pl-field__help">{help}</span>
  {/if}
  <input
    id={name ?? label}
    class="pl-input pl-focus-ring"
    type={type}
    name={name}
    placeholder={placeholder}
    value={value}
    required={required}
    disabled={disabled}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? `${name}-error` : undefined}
    oninput={(e) => {
      value = (e.currentTarget as HTMLInputElement).value;
      oninput?.(e);
    }}
  />
  {#if error}
    <span class="pl-field__error" id="{name}-error">{error}</span>
  {/if}
</div>
