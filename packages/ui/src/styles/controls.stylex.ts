/* Hallmark · Paperlight control recipes · StyleX is the source of component state */

import * as stylex from '@stylexjs/stylex';
import { paperlight } from '@oss-tips/design-tokens/paperlight.stylex';

export const controls = stylex.create({
  button: {
    alignItems: 'center',
    borderRadius: paperlight.radiusMd,
    borderStyle: 'solid',
    borderWidth: 1,
    cursor: 'pointer',
    display: 'inline-grid',
    fontFamily: paperlight.uiFont,
    fontSize: '0.9375rem',
    fontWeight: 600,
    gap: paperlight.space2,
    justifyContent: 'center',
    lineHeight: 1,
    minHeight: paperlight.touchTarget,
    paddingInline: paperlight.space5,
    transitionDuration: {
      default: paperlight.motionFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionTimingFunction: paperlight.easeOut,
    transitionProperty: 'background-color, border-color, color, transform',
    ':active': {
      transform: 'translateY(1px) scale(0.99)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      ':active': {
        transform: 'none',
      },
    },
    ':disabled': {
      cursor: 'not-allowed',
      opacity: 0.5,
    },
  },
  buttonPrimary: {
    backgroundColor: paperlight.forest,
    borderColor: paperlight.forest,
    color: paperlight.onForest,
    '@media (hover: hover)': {
      ':hover': {
        backgroundColor: paperlight.forestHover,
        borderColor: paperlight.forestHover,
      },
    },
  },
  buttonSecondary: {
    backgroundColor: paperlight.surface,
    borderColor: paperlight.borderStrong,
    color: paperlight.ink,
    '@media (hover: hover)': {
      ':hover': {
        borderColor: paperlight.inkMuted,
      },
    },
  },
  buttonQuiet: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    color: paperlight.forest,
    '@media (hover: hover)': {
      ':hover': {
        backgroundColor: paperlight.canvasSubtle,
      },
    },
  },
  buttonDestructive: {
    backgroundColor: paperlight.danger,
    borderColor: paperlight.danger,
    color: paperlight.onForest,
    '@media (hover: hover)': {
      ':hover': {
        backgroundColor: paperlight.danger,
      },
    },
  },
  buttonIcon: {
    minWidth: paperlight.touchTarget,
    paddingInline: 0,
  },
  buttonLoading: {
    cursor: 'wait',
    opacity: 1,
    pointerEvents: 'none',
  },
  buttonDisabled: {
    cursor: 'not-allowed',
  },
  buttonContent: {
    gridArea: '1 / 1',
  },
  buttonContentHidden: {
    visibility: 'hidden',
  },
  buttonLoadingLabel: {
    gridArea: '1 / 1',
  },
  focusRing: {
    outlineColor: {
      default: 'transparent',
      ':focus-visible': paperlight.focus,
    },
    outlineOffset: {
      default: 3,
      ':focus-visible': 3,
    },
    outlineStyle: {
      default: 'solid',
      ':focus-visible': 'solid',
    },
    outlineWidth: {
      default: 2,
      ':focus-visible': 2,
    },
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: paperlight.space1,
  },
  fieldLabel: {
    color: paperlight.ink,
    fontFamily: paperlight.uiFont,
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  fieldHelp: {
    color: paperlight.inkMuted,
    fontFamily: paperlight.uiFont,
    fontSize: '0.875rem',
  },
  fieldError: {
    color: paperlight.danger,
    fontFamily: paperlight.uiFont,
    fontSize: '0.875rem',
    minHeight: '1lh',
  },
  input: {
    backgroundColor: paperlight.surface,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusMd,
    borderStyle: 'solid',
    borderWidth: 1,
    color: paperlight.ink,
    fontFamily: paperlight.uiFont,
    fontSize: '1rem',
    minHeight: paperlight.touchTarget,
    paddingBlock: paperlight.space2,
    paddingInline: paperlight.space3,
    width: '100%',
    '@media (hover: hover)': {
      ':hover': {
        borderColor: paperlight.borderStrong,
      },
    },
    ':active': {
      borderColor: paperlight.borderStrong,
    },
    ':disabled': {
      cursor: 'not-allowed',
      opacity: 0.58,
    },
  },
  inputDisabled: {
    cursor: 'not-allowed',
    opacity: 0.58,
  },
  inputError: {
    borderColor: paperlight.danger,
  },
  segmented: {
    alignItems: 'stretch',
    backgroundColor: paperlight.canvasSubtle,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusMd,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'flex',
    flexWrap: 'wrap',
    overflow: 'hidden',
    maxWidth: '100%',
    minWidth: 0,
  },
  segment: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: paperlight.ink,
    cursor: 'pointer',
    flex: '1 1 auto',
    fontFamily: paperlight.uiFont,
    fontSize: '0.875rem',
    fontWeight: 600,
    minHeight: paperlight.touchTarget,
    minWidth: 0,
    whiteSpace: 'nowrap',
    paddingInline: paperlight.space4,
    transitionDuration: {
      default: paperlight.motionFast,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionProperty: 'background-color, color',
    transitionTimingFunction: paperlight.easeOut,
    '@media (hover: hover)': {
      ':hover': {
        color: paperlight.ink,
      },
    },
    ':active': {
      backgroundColor: paperlight.surfaceRaised,
    },
  },
  segmentSelected: {
    backgroundColor: paperlight.surface,
    color: paperlight.ink,
  },
  segmentDisabled: {
    cursor: 'not-allowed',
    opacity: 0.58,
    pointerEvents: 'none',
  },
  progress: {
    backgroundColor: paperlight.canvasSubtle,
    borderRadius: paperlight.radiusRound,
    height: '0.5rem',
    overflow: 'hidden',
    width: '100%',
  },
  progressBar: {
    backgroundColor: paperlight.forest,
    borderRadius: paperlight.radiusRound,
    height: '100%',
    transitionDuration: {
      default: paperlight.motionSlow,
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionProperty: 'width',
    transitionTimingFunction: paperlight.easeOut,
  },
  progressBarWidth: (width: string) => ({
    width,
  }),
  themeToggle: {
    alignItems: 'center',
    backgroundColor: paperlight.surface,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusMd,
    borderStyle: 'solid',
    borderWidth: 1,
    color: paperlight.inkMuted,
    cursor: 'pointer',
    display: 'inline-flex',
    fontFamily: paperlight.uiFont,
    fontSize: '0.875rem',
    gap: paperlight.space1,
    minHeight: paperlight.touchTarget,
    paddingBlock: paperlight.space1,
    paddingInline: paperlight.space3,
    '@media (hover: hover)': {
      ':hover': {
        borderColor: paperlight.borderStrong,
        color: paperlight.ink,
      },
    },
  },
  localeSelect: {
    alignItems: 'center',
    backgroundColor: paperlight.surface,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusMd,
    borderStyle: 'solid',
    borderWidth: 1,
    color: paperlight.ink,
    cursor: 'pointer',
    display: 'inline-flex',
    fontFamily: paperlight.uiFont,
    fontSize: '0.875rem',
    minHeight: paperlight.touchTarget,
    minWidth: '4.5rem',
    paddingBlock: paperlight.space1,
    paddingInline: paperlight.space2,
    '@media (hover: hover)': {
      ':hover': {
        borderColor: paperlight.borderStrong,
      },
    },
  },
});

export const variants = {
  primary: controls.buttonPrimary,
  secondary: controls.buttonSecondary,
  quiet: controls.buttonQuiet,
  destructive: controls.buttonDestructive,
  icon: controls.buttonSecondary,
} as const;
