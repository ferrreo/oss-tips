/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4
 * Paperlight visual surfaces · editorial landscapes, project identity, data views
 */

import * as stylex from '@stylexjs/stylex';
import { paperlight } from '@oss-tips/design-tokens/paperlight.stylex';

export const visuals = stylex.create({
  heroLandscape: {
    backgroundColor: paperlight.canvasSubtle,
    height: 'clamp(16rem, 28vw, 22rem)',
    maxHeight: '22rem',
    minHeight: '16rem',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    '@media (max-width: 43.99rem)': {
      height: 'clamp(10rem, 28vw, 14rem)',
      maxHeight: '14rem',
      minHeight: '10rem',
    },
  },
  heroLandscapeCompact: {
    height: 'clamp(7.5rem, 14vw, 10rem)',
    maxHeight: '10rem',
    minHeight: '7.5rem',
    '@media (max-width: 43.99rem)': {
      height: 'clamp(6rem, 14vw, 8rem)',
      maxHeight: '8rem',
      minHeight: '6rem',
    },
  },
  heroPicture: {
    display: 'block',
    height: '100%',
  },
  heroImage: {
    display: 'block',
    height: '100%',
    minHeight: 'inherit',
    objectFit: 'cover',
    objectPosition: '72% 50%',
    transform: 'scale(1.01)',
    width: '100%',
    '@media (max-width: 43.99rem)': {
      objectPosition: '68% 50%',
    },
  },
  heroImageCompact: {
    minHeight: 'inherit',
  },

  wordmark: {
    display: 'inline-block',
    flexShrink: 0,
    lineHeight: 0,
    maxWidth: '100%',
    width: '10rem',
  },
  wordmarkCompact: {
    width: '9.5rem',
  },
  wordmarkLarge: {
    width: '11rem',
  },
  wordmarkImage: {
    display: 'block',
    height: 'auto',
    maxWidth: '100%',
    width: '100%',
  },

  projectHero: {
    paddingBlock: paperlight.space8,
  },
  projectIdentity: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: paperlight.space5,
    minWidth: 0,
    '@media (max-width: 43.99rem)': {
      gap: paperlight.space3,
    },
  },
  projectLogo: {
    alignItems: 'center',
    backgroundColor: paperlight.surfaceRaised,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusLg,
    borderStyle: 'solid',
    borderWidth: 1,
    color: paperlight.forest,
    display: 'flex',
    flex: '0 0 4rem',
    fontFamily: paperlight.displayFont,
    fontSize: '1.5rem',
    height: '4rem',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '4rem',
    '@media (max-width: 43.99rem)': {
      flexBasis: '3.25rem',
      height: '3.25rem',
      width: '3.25rem',
    },
  },
  projectLogoSmall: {
    flexBasis: '3rem',
    fontSize: '1.2rem',
    height: '3rem',
    width: '3rem',
  },
  projectLogoImage: {
    display: 'block',
    height: '100%',
    objectFit: 'cover',
    width: '100%',
  },
  projectLogoFallback: {
    lineHeight: 1,
  },
  projectBody: {
    flex: '1 1 auto',
    minWidth: 0,
  },
  projectHeading: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: paperlight.space2,
    marginBlockEnd: paperlight.space2,
  },
  projectName: {
    color: paperlight.ink,
    fontFamily: paperlight.displayFont,
    fontSize: '2rem',
    letterSpacing: '-0.02em',
    lineHeight: 1.05,
    margin: 0,
    overflowWrap: 'anywhere',
    '@media (max-width: 43.99rem)': {
      fontSize: '1.65rem',
    },
  },
  projectDescription: {
    color: paperlight.inkMuted,
    margin: 0,
    marginBlockEnd: paperlight.space3,
    maxWidth: '40rem',
  },
  projectLinks: {
    alignItems: 'baseline',
    display: 'flex',
    flexWrap: 'wrap',
    gap: `${paperlight.space1} ${paperlight.space2}`,
    minWidth: 0,
  },
  projectLink: {
    alignItems: 'center',
    color: paperlight.forest,
    display: 'inline-flex',
    fontFamily: paperlight.monoFont,
    fontSize: paperlight.textSm,
    maxWidth: '100%',
    minHeight: paperlight.touchTarget,
    overflowWrap: 'anywhere',
    transitionDuration: {
      default: paperlight.motionFast,
      '@media (prefers-reduced-motion: reduce)': paperlight.motionReduced,
    },
    transitionProperty: 'color, transform',
    transitionTimingFunction: paperlight.easeOut,
    wordBreak: 'break-word',
    '@media (hover: hover)': {
      ':hover': {
        color: paperlight.forestHover,
      },
    },
    ':active': {
      transform: 'translateY(1px) scale(0.99)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      ':active': {
        transform: 'none',
      },
    },
  },
  projectLinkSeparator: {
    color: paperlight.inkFaint,
  },
  projectTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: paperlight.space2,
    marginBlockStart: paperlight.space3,
  },

  chart: {
    backgroundColor: paperlight.surface,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusLg,
    borderStyle: 'solid',
    borderWidth: 1,
    margin: 0,
    padding: paperlight.space5,
    '@media (max-width: 43.99rem)': {
      padding: paperlight.space4,
    },
  },
  chartCaption: {
    alignItems: 'flex-start',
    display: 'flex',
    flexWrap: 'wrap',
    gap: `${paperlight.space2} ${paperlight.space6}`,
    justifyContent: 'space-between',
    marginBlockEnd: paperlight.space3,
  },
  chartTitle: {
    color: paperlight.ink,
    fontFamily: paperlight.displayFont,
    fontSize: '1.2rem',
    lineHeight: 1.1,
    margin: 0,
  },
  chartRange: {
    color: paperlight.inkMuted,
    fontSize: paperlight.textSm,
    margin: `${paperlight.space1} 0 0`,
  },
  chartLegend: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: `${paperlight.space2} ${paperlight.space4}`,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  chartLegendItem: {
    alignItems: 'center',
    color: paperlight.ink,
    display: 'inline-flex',
    fontSize: paperlight.textSm,
    gap: paperlight.space2,
  },
  chartLegendSwatch: {
    display: 'block',
    flex: '0 0 auto',
    height: '0.625rem',
    width: '1.25rem',
  },
  chartPlot: {
    borderRadius: paperlight.radiusMd,
    minWidth: 0,
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
    position: 'relative',
    width: '100%',
  },
  chartPlotControl: {
    backgroundColor: 'transparent',
    border: '0 solid transparent',
    borderRadius: paperlight.radiusMd,
    cursor: 'crosshair',
    inset: 0,
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
    padding: 0,
    position: 'absolute',
    transitionDuration: {
      default: paperlight.motionFast,
      '@media (prefers-reduced-motion: reduce)': paperlight.motionReduced,
    },
    transitionProperty: 'transform',
    transitionTimingFunction: paperlight.easeOut,
    width: '100%',
    zIndex: 2,
    ':active': {
      transform: 'translateY(1px) scale(0.99)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      ':active': {
        transform: 'none',
      },
    },
  },
  chartSvg: {
    display: 'block',
    height: 'auto',
    minHeight: '12rem',
    overflow: 'visible',
    width: '100%',
  },
  chartGrid: {
    stroke: paperlight.border,
    strokeWidth: 1,
  },
  chartTick: {
    fill: paperlight.inkMuted,
    fontFamily: paperlight.uiFont,
    fontSize: paperlight.textSm,
    '@media (max-width: 43.99rem)': {
      display: 'none',
    },
  },
  chartCursor: {
    stroke: paperlight.borderStrong,
    strokeDasharray: '3 3',
  },
  chartTooltip: {
    backgroundColor: paperlight.surfaceRaised,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusSm,
    borderStyle: 'solid',
    borderWidth: 1,
    boxShadow: paperlight.shadow,
    display: 'flex',
    flexDirection: 'column',
    fontSize: paperlight.textSm,
    fontVariantNumeric: 'tabular-nums',
    gap: paperlight.space1,
    left: 0,
    maxWidth: 'calc(100% - 1rem)',
    overflowWrap: 'anywhere',
    padding: `${paperlight.space1} ${paperlight.space2}`,
    pointerEvents: 'none',
    position: 'absolute',
    top: paperlight.space2,
    transform: 'translateX(-50%)',
    whiteSpace: 'normal',
    zIndex: 1,
  },
  chartTooltipPosition: (left: string) => ({
    left,
  }),
  chartTooltipStart: {
    transform: 'translateX(0)',
  },
  chartTooltipEnd: {
    transform: 'translateX(-100%)',
  },
  chartLive: {
    color: paperlight.inkMuted,
    fontSize: paperlight.textSm,
    fontVariantNumeric: 'tabular-nums',
    margin: `${paperlight.space2} 0 0`,
  },
  chartEmpty: {
    color: paperlight.inkMuted,
    marginBlock: paperlight.space10,
    textAlign: 'center',
  },
  chartTable: {
    borderCollapse: 'collapse',
    fontSize: '0.8125rem',
    fontVariantNumeric: 'tabular-nums',
    marginBlockStart: paperlight.space4,
    width: '100%',
    '@media (max-width: 43.99rem)': {
      display: 'none',
    },
  },
  chartTableCell: {
    borderBlockStart: `1px solid ${paperlight.border}`,
    padding: `${paperlight.space2} ${paperlight.space2}`,
    textAlign: 'start',
  },
  chartTableCaption: {
    captionSide: 'top',
    color: paperlight.ink,
    fontWeight: 600,
    paddingBlockEnd: paperlight.space1,
    textAlign: 'start',
  },
  chartTableRowActive: {
    backgroundColor: `color-mix(in srgb, ${paperlight.forest} 8%, transparent)`,
  },
  chartMobileData: {
    display: 'none',
    '@media (max-width: 43.99rem)': {
      display: 'flex',
      flexDirection: 'column',
      gap: paperlight.space2,
      marginBlockStart: paperlight.space4,
    },
  },
  chartMobileDisclosure: {
    display: 'none',
    '@media (max-width: 43.99rem)': {
      display: 'block',
      marginBlockStart: paperlight.space4,
    },
  },
  chartMobileSummary: {
    alignItems: 'center',
    backgroundColor: paperlight.canvasSubtle,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusMd,
    borderStyle: 'solid',
    borderWidth: 1,
    color: paperlight.ink,
    cursor: 'pointer',
    display: 'flex',
    fontFamily: paperlight.uiFont,
    fontSize: paperlight.textSm,
    fontWeight: 600,
    justifyContent: 'space-between',
    minHeight: paperlight.touchTarget,
    paddingInline: paperlight.space3,
    transitionDuration: {
      default: paperlight.motionFast,
      '@media (prefers-reduced-motion: reduce)': paperlight.motionReduced,
    },
    transitionProperty: 'background-color, border-color, color, transform',
    transitionTimingFunction: paperlight.easeOut,
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
    ':active': {
      transform: 'translateY(1px) scale(0.99)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      ':active': {
        transform: 'none',
      },
    },
  },
  chartMobileRow: {
    backgroundColor: paperlight.canvasSubtle,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusMd,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: paperlight.space2,
    padding: paperlight.space3,
  },
  chartMobileRowActive: {
    borderColor: paperlight.forest,
    boxShadow: `inset 0 0 0 1px ${paperlight.forest}`,
  },
  chartMobileDate: {
    color: paperlight.ink,
    fontSize: paperlight.textSm,
    fontWeight: 600,
  },
  chartMobileValues: {
    display: 'grid',
    gap: `${paperlight.space1} ${paperlight.space4}`,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    margin: 0,
  },
  chartMobileValue: {
    minWidth: 0,
  },
  chartMobileLabel: {
    color: paperlight.inkMuted,
    fontSize: paperlight.textSm,
    margin: 0,
  },
  chartMobileNumber: {
    color: paperlight.ink,
    fontSize: paperlight.textSm,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    margin: 0,
  },
});
