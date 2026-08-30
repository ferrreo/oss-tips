/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
 * Shared Paperlight primitives · component-scope · interaction states supplied by consumers
 */

import * as stylex from '@stylexjs/stylex';
import { paperlight } from '@oss-tips/design-tokens/paperlight.stylex';

export const primitives = stylex.create({
  container: {
    marginInline: 'auto',
    maxWidth: paperlight.contentMax,
    paddingInline: paperlight.space6,
    width: '100%',
  },
  reading: {
    maxWidth: paperlight.readingMax,
  },
  display: {
    fontFamily: paperlight.displayFont,
  },
  mono: {
    fontFamily: paperlight.monoFont,
    fontSize: '0.875em',
  },
  muted: {
    color: paperlight.inkMuted,
  },
  surface: {
    backgroundColor: paperlight.surface,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusLg,
    borderStyle: 'solid',
    borderWidth: 1,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: paperlight.space4,
  },
  row: {
    alignItems: 'center',
    display: 'flex',
    gap: paperlight.space3,
  },
  focusRing: {
    outlineColor: {
      default: 'transparent',
      ':focus-visible': paperlight.focus,
    },
    outlineOffset: {
      default: 0,
      ':focus-visible': 3,
    },
    outlineStyle: {
      default: 'solid',
      ':focus-visible': 'solid',
    },
    outlineWidth: {
      default: 0,
      ':focus-visible': 2,
    },
    ':disabled': {
      cursor: 'not-allowed',
      opacity: 0.58,
    },
  },
  srOnly: {
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: 1,
  },
});
