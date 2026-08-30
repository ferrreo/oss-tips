export interface ChartPoint {
  label: string;
  value: number;
}

export type ChartStroke = 'solid' | 'dashed';
export type ChartMarker = 'circle' | 'square' | 'diamond';

export interface ChartSeries {
  id: string;
  label: string;
  points: ChartPoint[];
  stroke?: ChartStroke;
  marker?: ChartMarker;
}

export const CHART_WIDTH = 640;
export const CHART_HEIGHT = 220;
export const CHART_PAD = { top: 18, right: 18, bottom: 32, left: 48 } as const;

export function chartLabels(series: ChartSeries[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const item of series) {
    for (const point of item.points) {
      if (!seen.has(point.label)) {
        seen.add(point.label);
        labels.push(point.label);
      }
    }
  }
  return labels;
}

export function valueDomain(series: ChartSeries[]): { min: number; max: number } {
  let max = 0;
  let min = 0;
  let seen = false;
  for (const item of series) {
    for (const point of item.points) {
      if (!seen) {
        max = point.value;
        min = Math.min(0, point.value);
        seen = true;
        continue;
      }
      if (point.value > max) max = point.value;
      if (point.value < min) min = point.value;
    }
  }
  if (!seen || max === min) {
    return { min: 0, max: max === 0 ? 1 : max + 1 };
  }
  const pad = (max - min) * 0.08;
  return { min: min === 0 ? 0 : min - pad, max: max + pad };
}

export function xForLabel(label: string, labels: string[]): number {
  const index = labels.indexOf(label);
  const inner = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
  if (labels.length <= 1) return CHART_PAD.left + inner / 2;
  return CHART_PAD.left + (Math.max(0, index) / (labels.length - 1)) * inner;
}

export function yForValue(value: number, domain: { min: number; max: number }): number {
  const inner = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
  const span = domain.max - domain.min || 1;
  const t = (value - domain.min) / span;
  return CHART_PAD.top + inner * (1 - t);
}

export function seriesPath(
  series: ChartSeries,
  labels: string[],
  domain: { min: number; max: number },
): string {
  const coords = series.points
    .filter((point) => labels.includes(point.label))
    .map((point) => ({
      x: xForLabel(point.label, labels),
      y: yForValue(point.value, domain),
    }));
  if (coords.length === 0) return '';
  return coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)} ${coord.y.toFixed(2)}`)
    .join(' ');
}

export function yTicks(domain: { min: number; max: number }, count = 4): number[] {
  const ticks: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    ticks.push(domain.min + (domain.max - domain.min) * t);
  }
  return ticks;
}

export function formatTick(value: number): string {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

export function valueForLabel(series: ChartSeries, label: string): number | undefined {
  return series.points.find((point) => point.label === label)?.value;
}

const AUGUST_LABELS = ['4 Aug', '8 Aug', '12 Aug', '16 Aug', '20 Aug', '24 Aug', '28 Aug'];

function seriesFromValues(
  id: string,
  label: string,
  values: number[],
  stroke: ChartStroke,
  marker: ChartMarker,
): ChartSeries {
  return {
    id,
    label,
    stroke,
    marker,
    points: AUGUST_LABELS.map((pointLabel, index) => ({
      label: pointLabel,
      value: values[index] ?? 0,
    })),
  };
}

export function demoRevenueSeries(): ChartSeries[] {
  return [
    seriesFromValues('one-off', 'One-off', [420, 180, 610, 240, 390, 860, 310], 'solid', 'circle'),
    seriesFromValues(
      'recurring',
      'Recurring',
      [980, 1010, 1040, 1090, 1125, 1180, 1245],
      'dashed',
      'square',
    ),
  ];
}

export function demoGrowthSeries(): ChartSeries[] {
  return [
    seriesFromValues(
      'supporters',
      'Supporters',
      [248, 252, 255, 261, 268, 276, 284],
      'solid',
      'circle',
    ),
  ];
}
