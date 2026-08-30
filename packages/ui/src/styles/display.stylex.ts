/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
 * Paperlight display primitives. State is carried by semantic markup and
 * StyleX variants so these components do not depend on legacy global classes.
 */

import * as stylex from '@stylexjs/stylex';
import { paperlight } from '@oss-tips/design-tokens/paperlight.stylex';

// Keep StyleX's Svelte-facing runtime call in this sidecar. The bundler can
// compile this TypeScript module before Svelte templates consume its attrs.
export const attrs = stylex.attrs;

export const display = stylex.create({
  badge: {
    alignItems: 'center',
    backgroundColor: paperlight.canvasSubtle,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusRound,
    borderStyle: 'solid',
    borderWidth: 1,
    color: paperlight.inkMuted,
    display: 'inline-flex',
    fontFamily: paperlight.uiFont,
    fontSize: paperlight.textSm,
    fontWeight: 600,
    lineHeight: 1.25,
    minHeight: '1.5rem',
    paddingBlock: paperlight.space1,
    paddingInline: paperlight.space2,
    whiteSpace: 'nowrap',
  },
  badgeForest: {
    borderColor: paperlight.forest,
    color: paperlight.forest,
  },
  badgeDanger: {
    backgroundColor: paperlight.danger,
    borderColor: paperlight.danger,
    color: paperlight.onForest,
  },
  badgeOchre: {
    borderColor: paperlight.ochre,
    color: paperlight.ink,
  },

  statusBanner: {
    backgroundColor: paperlight.surface,
    borderColor: paperlight.borderStrong,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'block',
    fontFamily: paperlight.uiFont,
    paddingBlock: paperlight.space3,
    paddingInlineEnd: paperlight.space3,
    paddingInlineStart: paperlight.space4,
  },
  statusBannerInfo: {
    borderColor: paperlight.info,
  },
  statusBannerWarning: {
    borderColor: paperlight.warning,
  },
  statusBannerDanger: {
    borderColor: paperlight.danger,
  },
  statusTitle: {
    color: paperlight.ink,
    fontSize: '0.9375rem',
    fontWeight: 600,
    margin: 0,
  },
  statusMessage: {
    color: paperlight.inkMuted,
    fontSize: paperlight.textSm,
    marginBlockStart: paperlight.space1,
    marginBlockEnd: 0,
    maxWidth: '40rem',
  },

  toast: {
    alignItems: 'center',
    backgroundColor: paperlight.surfaceRaised,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusMd,
    borderStyle: 'solid',
    borderWidth: 1,
    boxShadow: paperlight.shadow,
    display: 'flex',
    gap: paperlight.space3,
    maxWidth: '24rem',
    paddingBlock: paperlight.space3,
    paddingInline: paperlight.space4,
  },
  toastIcon: {
    alignItems: 'center',
    borderRadius: paperlight.radiusRound,
    display: 'inline-flex',
    flex: '0 0 auto',
    fontSize: paperlight.textSm,
    fontWeight: 700,
    height: '1.25rem',
    justifyContent: 'center',
    lineHeight: 1,
    width: '1.25rem',
  },
  toastIconDefault: {
    backgroundColor: paperlight.canvasSubtle,
    color: paperlight.inkMuted,
  },
  toastIconSuccess: {
    backgroundColor: paperlight.success,
    color: paperlight.onForest,
  },
  toastIconError: {
    backgroundColor: paperlight.danger,
    color: paperlight.onForest,
  },
  toastMessage: {
    color: paperlight.ink,
    fontFamily: paperlight.uiFont,
    fontSize: '0.9375rem',
  },

  empty: {
    paddingBlock: paperlight.space12,
    paddingInline: paperlight.space6,
    textAlign: 'center',
  },
  emptyIcon: {
    display: 'block',
    height: '3rem',
    marginBlockEnd: paperlight.space4,
    marginInline: 'auto',
    width: '3rem',
  },
  emptyIconCircle: {
    opacity: 0.55,
    stroke: paperlight.borderStrong,
    strokeWidth: 2,
  },
  emptyIconPath: {
    stroke: paperlight.fern,
    strokeLinecap: 'round',
    strokeWidth: 2,
  },
  emptyTitle: {
    color: paperlight.ink,
    fontFamily: paperlight.displayFont,
    fontSize: '1.25rem',
    fontWeight: 500,
    marginBlockEnd: paperlight.space2,
    marginBlockStart: 0,
  },
  emptyText: {
    color: paperlight.inkMuted,
    marginBlockEnd: paperlight.space6,
    marginBlockStart: 0,
    marginInline: 'auto',
    maxWidth: '24rem',
  },

  dataCard: {
    backgroundColor: paperlight.surface,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusLg,
    borderStyle: 'solid',
    borderWidth: 1,
    minWidth: 0,
    padding: paperlight.space5,
  },
  dataCardHead: {
    alignItems: 'center',
    display: 'flex',
    gap: paperlight.space3,
    justifyContent: 'space-between',
    marginBlockEnd: paperlight.space1,
  },
  dataCardLabel: {
    color: paperlight.inkMuted,
    fontFamily: paperlight.uiFont,
    fontSize: paperlight.textSm,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  dataCardSpark: {
    flexShrink: 0,
    height: '1.25rem',
    width: '4rem',
  },
  dataCardSparkPath: {
    fill: 'none',
    stroke: paperlight.moss,
    strokeLinecap: 'round',
    strokeWidth: 1.5,
  },
  dataCardValue: {
    color: paperlight.ink,
    fontFamily: paperlight.displayFont,
    fontSize: paperlight.text2xl,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.1,
  },
  dataCardCompare: {
    alignItems: 'center',
    color: paperlight.inkMuted,
    display: 'flex',
    fontFamily: paperlight.uiFont,
    fontSize: paperlight.textSm,
    gap: paperlight.space2,
    marginBlockStart: paperlight.space2,
  },
  dataCardCompareUp: {
    color: paperlight.success,
  },
  dataCardCompareDown: {
    color: paperlight.danger,
  },
  dataCardArrow: {
    fontSize: paperlight.textSm,
    lineHeight: 1,
  },

  tableWrap: {
    overflowX: 'auto',
    width: '100%',
    '@media (max-width: 43.99rem)': {
      overflowX: 'visible',
    },
  },
  table: {
    borderCollapse: 'collapse',
    color: paperlight.ink,
    fontFamily: paperlight.uiFont,
    fontSize: '0.9375rem',
    width: '100%',
    '@media (max-width: 43.99rem)': {
      display: 'block',
    },
  },
  tableCaption: {
    captionSide: 'top',
    color: paperlight.inkMuted,
    paddingBlockEnd: paperlight.space2,
    textAlign: 'start',
    '@media (max-width: 43.99rem)': {
      display: 'block',
      width: '100%',
    },
  },
  tableHead: {
    backgroundColor: paperlight.canvasSubtle,
    borderBottomColor: paperlight.border,
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    color: paperlight.ink,
    fontSize: '0.8125rem',
    fontWeight: 600,
    paddingBlock: paperlight.space3,
    paddingInline: paperlight.space4,
    textAlign: 'start',
    '@media (max-width: 43.99rem)': {
      clip: 'rect(0 0 0 0)',
      clipPath: 'inset(50%)',
      height: 1,
      overflow: 'hidden',
      position: 'absolute',
      whiteSpace: 'nowrap',
      width: 1,
    },
  },
  tableBody: {
    '@media (max-width: 43.99rem)': {
      display: 'grid',
      gap: paperlight.space3,
    },
  },
  tableRow: {
    '@media (max-width: 43.99rem)': {
      backgroundColor: paperlight.surface,
      borderColor: paperlight.border,
      borderRadius: paperlight.radiusMd,
      borderStyle: 'solid',
      borderWidth: 1,
      display: 'grid',
      gap: paperlight.space3,
      padding: paperlight.space4,
    },
  },
  tableCell: {
    borderBottomColor: paperlight.border,
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    paddingBlock: paperlight.space3,
    paddingInline: paperlight.space4,
    verticalAlign: 'top',
    '@media (max-width: 43.99rem)': {
      alignItems: 'start',
      borderBottomWidth: 0,
      display: 'grid',
      gap: paperlight.space3,
      gridTemplateColumns: 'minmax(5rem, 32%) minmax(0, 1fr)',
      minWidth: 0,
      overflowWrap: 'break-word',
      padding: 0,
    },
  },
  tableMobileLabel: {
    display: 'none',
    '@media (max-width: 43.99rem)': {
      color: paperlight.inkMuted,
      display: 'block',
      fontSize: paperlight.textSm,
      fontWeight: 600,
    },
  },
  tableLink: {
    alignItems: 'center',
    color: paperlight.forest,
    display: 'inline-flex',
    fontWeight: 650,
    minHeight: paperlight.touchTarget,
    textDecoration: 'underline',
    transitionDuration: {
      default: paperlight.motionFast,
      '@media (prefers-reduced-motion: reduce)': paperlight.motionReduced,
    },
    transitionProperty: 'color, transform',
    transitionTimingFunction: paperlight.easeOut,
    ':active': {
      transform: 'translateY(1px) scale(0.99)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      ':active': {
        transform: 'none',
      },
    },
  },

  goal: {
    backgroundColor: paperlight.surface,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusLg,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: paperlight.space5,
  },
  goalHeader: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: paperlight.space4,
    justifyContent: 'space-between',
    marginBlockEnd: paperlight.space3,
  },
  goalOverline: {
    color: paperlight.inkFaint,
    fontFamily: paperlight.uiFont,
    fontSize: paperlight.textSm,
    fontWeight: 700,
    letterSpacing: '0.06em',
    marginBlockEnd: paperlight.space1,
    marginBlockStart: 0,
    textTransform: 'uppercase',
  },
  goalTitle: {
    color: paperlight.ink,
    fontFamily: paperlight.displayFont,
    fontSize: '1.25rem',
    fontWeight: 500,
    margin: 0,
  },
  goalAmount: {
    color: paperlight.ink,
    fontFamily: paperlight.displayFont,
    fontSize: '1.5rem',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.1,
  },
  goalDescription: {
    color: paperlight.inkMuted,
    fontSize: paperlight.textSm,
    marginBlockEnd: paperlight.space3,
    marginBlockStart: 0,
  },
  goalMeta: {
    alignItems: 'baseline',
    display: 'flex',
    fontSize: paperlight.textSm,
    gap: paperlight.space4,
    justifyContent: 'space-between',
    marginBlockStart: paperlight.space3,
    '@media (max-width: 43.99rem)': {
      alignItems: 'flex-start',
      flexDirection: 'column',
      gap: paperlight.space1,
    },
  },
  goalRaised: {
    color: paperlight.ink,
    fontVariantNumeric: 'tabular-nums',
  },
  goalMuted: {
    color: paperlight.inkMuted,
  },
  goalBasis: {
    color: paperlight.inkMuted,
    fontSize: paperlight.textSm,
    marginBlockEnd: 0,
    marginBlockStart: paperlight.space2,
  },
  goalBotanical: {
    display: 'block',
    height: '1rem',
    marginBlockStart: paperlight.space3,
    width: '3rem',
  },
  goalBotanicalStem: {
    fill: 'none',
    stroke: paperlight.fern,
    strokeLinecap: 'round',
    strokeWidth: 1.5,
  },
  goalBotanicalMoss: {
    fill: paperlight.moss,
    opacity: 0.7,
  },
  goalBotanicalOchre: {
    fill: paperlight.ochre,
    opacity: 0.7,
  },
  goalBotanicalNode: {
    fill: paperlight.ink,
  },

  chartPlaceholder: {
    minWidth: 0,
    width: '100%',
  },
});
