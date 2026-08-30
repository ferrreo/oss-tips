import tokens from '../tokens.json' with { type: 'json' };

export { paperlight, paperlightDark } from './paperlight.stylex.js';

export { tokens };

export const colour = tokens.colour;
export const typography = tokens.typography;
export const space = tokens.space;
export const radius = tokens.radius;
export const shadow = tokens.shadow;
export const motion = tokens.motion;
export const layout = tokens.layout;

export type ThemeName = 'light' | 'dark';

export function cssVariables(theme: ThemeName): Record<string, string> {
  const c = tokens.colour[theme];
  return {
    '--pl-canvas': c.canvas,
    '--pl-canvas-subtle': c.canvasSubtle,
    '--pl-surface': c.surface,
    '--pl-surface-raised': c.surfaceRaised,
    '--pl-ink': c.ink,
    '--pl-ink-muted': c.inkMuted,
    '--pl-ink-faint': c.inkFaint,
    '--pl-forest': c.forest,
    '--pl-forest-hover': c.forestHover,
    '--pl-moss': c.moss,
    '--pl-fern': c.fern,
    '--pl-ochre': c.ochre,
    '--pl-border': c.border,
    '--pl-border-strong': c.borderStrong,
    '--pl-success': c.success,
    '--pl-warning': c.warning,
    '--pl-danger': c.danger,
    '--pl-info': c.info,
    '--pl-focus': c.focus,
    '--pl-overlay': c.overlay,
    '--pl-shadow': tokens.shadow[theme],
    '--pl-font-display': tokens.typography.displayFamily,
    '--pl-font-ui': tokens.typography.uiFamily,
    '--pl-font-mono': tokens.typography.monoFamily,
  };
}
