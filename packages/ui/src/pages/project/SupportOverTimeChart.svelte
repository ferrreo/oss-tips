<script lang="ts">
  import type { ChartSeries } from './project-demo.js';

  interface Props {
    title?: string;
    range?: string;
    labels: string[];
    series: ChartSeries[];
    valuePrefix?: string;
  }

  let {
    title = 'Support over time',
    range = 'Last 12 months · Europe/London',
    labels,
    series,
    valuePrefix = '$',
  }: Props = $props();

  const width = 720;
  const height = 220;
  const padL = 52;
  const padR = 16;
  const padT = 18;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allValues = $derived(series.flatMap((item) => item.values));
  const rawMax = $derived(Math.max(1, ...allValues));
  const yTicks = $derived.by(() => {
    const step = rawMax > 2000 ? 2000 : rawMax > 400 ? 100 : 10;
    const top = Math.ceil((rawMax * 1.08) / step) * step || step;
    return [0, top / 2, top];
  });
  const scaleMax = $derived(yTicks[yTicks.length - 1] || 1);

  function xAt(index: number, count: number): number {
    if (count <= 1) return padL;
    return padL + (index / (count - 1)) * plotW;
  }

  function yAt(value: number): number {
    return padT + (1 - value / scaleMax) * plotH;
  }

  function toPath(values: number[]): string {
    return values
      .map((value, index) => {
        const command = index === 0 ? 'M' : 'L';
        return `${command}${xAt(index, values.length).toFixed(1)} ${yAt(value).toFixed(1)}`;
      })
      .join(' ');
  }
</script>

<section class="pl-surface" style="padding: 1.25rem;">
  <div class="pl-row pl-row--between" style="margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
    <div>
      <h2 style="font-size: 1.125rem; font-family: var(--pl-font-ui); font-weight: 600;">{title}</h2>
      <p style="margin: 0.25rem 0 0; font-size: 0.8125rem; color: var(--pl-ink);">{range}</p>
    </div>
    <ul style="display: flex; flex-wrap: wrap; gap: 1rem; list-style: none; margin: 0; padding: 0;">
      {#each series as item (item.id)}
        <li style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; color: var(--pl-ink);">
          <span
            aria-hidden="true"
            style="width: 1.25rem; border-top: 2px {item.dashed ? 'dashed' : 'solid'} {item.color};"
          ></span>
          {item.label}
        </li>
      {/each}
    </ul>
  </div>

  <svg
    viewBox="0 0 {width} {height}"
    role="img"
    aria-label="{title}. {series.map((item) => item.label).join(', ')} — {range}"
    style="width: 100%; height: auto; display: block;"
  >
    {#each yTicks as tick (tick)}
      <line
        x1={padL}
        x2={width - padR}
        y1={yAt(tick)}
        y2={yAt(tick)}
        stroke="var(--pl-border)"
        stroke-width="1"
      />
      <text
        x={padL - 8}
        y={yAt(tick) + 4}
        text-anchor="end"
        fill="var(--pl-ink)"
        font-size="11"
        font-family="var(--pl-font-ui)"
      >
        {valuePrefix}{Math.round(tick).toLocaleString('en-US')}
      </text>
    {/each}

    {#each labels as label, index (label)}
      <text
        x={xAt(index, labels.length)}
        y={height - 8}
        text-anchor="middle"
        fill="var(--pl-ink)"
        font-size="11"
        font-family="var(--pl-font-ui)"
      >
        {label}
      </text>
    {/each}

    {#each series as item (item.id)}
      <path
        d={toPath(item.values)}
        fill="none"
        stroke={item.color}
        stroke-width="2.25"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-dasharray={item.dashed ? '6 4' : 'none'}
      />
    {/each}
  </svg>

  <div class="pl-table-wrap" style="margin-top: 1rem;">
    <table class="pl-table">
      <caption class="pl-muted" style="caption-side: top; padding-bottom: 0.5rem; text-align: left;">
        Monthly values for {title}
      </caption>
      <thead>
        <tr>
          <th scope="col">Series</th>
          {#each labels as label (label)}
            <th scope="col">{label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each series as item (item.id)}
          <tr>
            <th scope="row">{item.label}</th>
            {#each item.values as value, index (`${item.id}-${labels[index]}`)}
              <td>{valuePrefix}{value.toLocaleString('en-US')}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
