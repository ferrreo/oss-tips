import { describe, expect, it } from 'vitest';
import {
  chartLabels,
  demoRevenueSeries,
  seriesPath,
  valueDomain,
  xForLabel,
  yForValue,
} from './chartModel.js';

describe('chartModel', () => {
  it('keeps first-seen label order across series', () => {
    const labels = chartLabels([
      {
        id: 'a',
        label: 'A',
        points: [
          { label: 'Mon', value: 1 },
          { label: 'Wed', value: 2 },
        ],
      },
      {
        id: 'b',
        label: 'B',
        points: [
          { label: 'Tue', value: 3 },
          { label: 'Wed', value: 4 },
        ],
      },
    ]);
    expect(labels).toEqual(['Mon', 'Wed', 'Tue']);
  });

  it('anchors a non-negative domain at zero', () => {
    const domain = valueDomain(demoRevenueSeries());
    expect(domain.min).toBe(0);
    expect(domain.max).toBeGreaterThan(1245);
  });

  it('maps the first and last labels to the plot edges', () => {
    const labels = ['a', 'b', 'c'];
    expect(xForLabel('a', labels)).toBe(48);
    expect(xForLabel('c', labels)).toBe(622);
  });

  it('maps the domain max to the top pad', () => {
    expect(yForValue(10, { min: 0, max: 10 })).toBe(18);
  });

  it('builds a polyline for aligned points', () => {
    const series = demoRevenueSeries()[0];
    if (!series) throw new Error('expected a revenue series');
    const labels = chartLabels([series]);
    const path = seriesPath(series, labels, valueDomain([series]));
    expect(path.startsWith('M')).toBe(true);
    expect(path.includes(' L')).toBe(true);
  });
});
