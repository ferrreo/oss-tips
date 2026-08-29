<script lang="ts">
  import SegmentedControl from './SegmentedControl.svelte';
  import TextField from './TextField.svelte';
  import { formatMoney } from '../fixtures/demo.js';
  import { labelCadence } from '../lib/labels.js';

  interface Props {
    currency?: string;
    presets?: number[];
    cadence?: string;
    selectedAmountMinor?: number;
    oncadencechange?: (cadence: string) => void;
    onamountchange?: (minor: number) => void;
  }

  let {
    currency = 'GBP',
    presets = [500, 1000, 2500, 5000],
    cadence = $bindable('one-off'),
    selectedAmountMinor = $bindable(1000),
    oncadencechange,
    onamountchange,
  }: Props = $props();

  let customAmount = $state('');

  const cadenceOptions = [
    { value: 'one-off', label: 'One-off' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'annual', label: 'Annual' },
  ];

  function selectPreset(minor: number) {
    selectedAmountMinor = minor;
    customAmount = '';
    onamountchange?.(minor);
  }
</script>

<div class="pl-composer">
  <h3 class="pl-display" style="font-size: 1.25rem; margin-bottom: 0.75rem;">Support this project</h3>
  <SegmentedControl
    options={cadenceOptions}
    value={cadence}
    label="Cadence"
    onchange={(v) => {
      cadence = v;
      oncadencechange?.(v);
    }}
  />
  <div class="pl-composer__presets" style="margin-top: 1rem;">
    {#each presets as preset (preset)}
      <button
        type="button"
        class="pl-composer__preset pl-focus-ring {selectedAmountMinor === preset ? 'pl-composer__preset--selected' : ''}"
        onclick={() => selectPreset(preset)}
      >
        {formatMoney(preset, currency)}
      </button>
    {/each}
  </div>
  <div style="margin-top: 1rem;">
    <TextField
      label="Custom amount"
      type="number"
      placeholder="Enter amount"
      bind:value={customAmount}
      help="Minimum £2.00. Localised at checkout."
      oninput={(event) => {
        const major = parseFloat((event.currentTarget as HTMLInputElement).value);
        if (!isNaN(major)) {
          selectedAmountMinor = Math.round(major * 100);
          onamountchange?.(selectedAmountMinor);
        }
      }}
    />
  </div>
  <p class="pl-muted" style="margin-top: 1rem; font-size: 0.875rem;">
    Selected: <strong>{formatMoney(selectedAmountMinor, currency)}</strong>
    {#if cadence !== 'one-off'}
      / {labelCadence(cadence)}
    {/if}
  </p>
</div>
