/* Hallmark · public-page contract: editorial, direct, readable, responsive */

import * as stylex from '@stylexjs/stylex';
import { paperlight } from '@oss-tips/design-tokens/paperlight.stylex';

const successFlourishReveal = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(4px) scale(0.96)' },
  to: { opacity: 1, transform: 'translateY(0) scale(1)' },
});

export const publicStyles = stylex.create({
  page: {
    backgroundColor: paperlight.canvas,
    color: paperlight.ink,
    minHeight: '100vh',
  },
  main: {
    minHeight: '60vh',
  },
  container: {
    boxSizing: 'border-box',
    marginInline: 'auto',
    maxWidth: paperlight.contentMax,
    paddingInline: paperlight.space6,
    width: '100%',
    '@media (max-width: 43.99rem)': {
      paddingInline: paperlight.space4,
    },
  },
  reading: {
    maxWidth: paperlight.readingMax,
  },
  section: {
    paddingBlock: paperlight.space16,
    '@media (max-width: 43.99rem)': {
      paddingBlock: paperlight.space12,
    },
  },
  sectionTight: {
    paddingTop: 0,
    paddingBottom: paperlight.space16,
    '@media (max-width: 43.99rem)': {
      paddingBottom: paperlight.space12,
    },
  },
  hero: {
    backgroundColor: paperlight.canvasSubtle,
    borderBottomColor: paperlight.border,
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    paddingBlockStart: paperlight.space12,
    paddingBlockEnd: paperlight.space16,
    '@media (max-width: 43.99rem)': {
      paddingBlockStart: paperlight.space8,
      paddingBlockEnd: paperlight.space12,
    },
  },
  heroSplit: {
    alignItems: 'center',
    display: 'grid',
    gap: paperlight.space12,
    gridTemplateColumns: 'minmax(0, 1.1fr) minmax(18rem, 0.9fr)',
    '@media (max-width: 54rem)': {
      gap: paperlight.space8,
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  heroCopy: {
    maxWidth: '42rem',
  },
  heroTitle: {
    fontFamily: paperlight.displayFont,
    fontSize: 'clamp(2.75rem, 8vw, 5.5rem)',
    letterSpacing: '-0.045em',
    lineHeight: 0.98,
    marginBlock: paperlight.space4,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  heroTitleLong: {
    fontSize: 'clamp(2.5rem, 7vw, 5rem)',
  },
  pageTitle: {
    fontFamily: paperlight.displayFont,
    fontSize: 'clamp(2.25rem, 6vw, 4rem)',
    letterSpacing: '-0.035em',
    lineHeight: 1,
    marginBlock: paperlight.space3,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  sectionTitle: {
    fontFamily: paperlight.displayFont,
    fontSize: 'clamp(1.35rem, 2vw, 1.75rem)',
    letterSpacing: '-0.02em',
    lineHeight: 1.08,
    marginBottom: paperlight.space4,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  lead: {
    color: paperlight.inkMuted,
    fontSize: paperlight.textLg,
    lineHeight: 1.55,
    maxWidth: '42rem',
  },
  small: {
    fontSize: paperlight.textSm,
  },
  muted: {
    color: paperlight.inkMuted,
  },
  mono: {
    fontFamily: paperlight.monoFont,
    fontSize: paperlight.textSm,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  row: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: paperlight.space3,
  },
  stack: {
    display: 'grid',
    gap: paperlight.space6,
    minWidth: 0,
  },
  grid: {
    display: 'grid',
    gap: paperlight.space4,
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 16rem), 1fr))',
    minWidth: 0,
  },
  twoColumn: {
    display: 'grid',
    gap: paperlight.space6,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    '@media (max-width: 43.99rem)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  surface: {
    backgroundColor: paperlight.surface,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusLg,
    borderStyle: 'solid',
    borderWidth: 1,
    minWidth: 0,
    padding: paperlight.space5,
  },
  panel: {
    backgroundColor: paperlight.canvasSubtle,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusLg,
    borderStyle: 'solid',
    borderWidth: 1,
    minWidth: 0,
    padding: paperlight.space6,
  },
  prose: {
    fontSize: '1.0625rem',
    lineHeight: 1.65,
  },
  meta: {
    display: 'grid',
    gap: paperlight.space3,
    marginBlock: paperlight.space6,
  },
  metaLabel: {
    color: paperlight.inkMuted,
    fontSize: paperlight.textSm,
    marginBottom: paperlight.space1,
  },
  action: {
    alignItems: 'center',
    borderRadius: paperlight.radiusMd,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'inline-flex',
    fontFamily: paperlight.uiFont,
    fontSize: paperlight.textMd,
    fontWeight: 600,
    justifyContent: 'center',
    minHeight: paperlight.touchTarget,
    paddingInline: paperlight.space5,
    textDecoration: 'none',
    transitionDuration: {
      default: paperlight.motionFast,
      '@media (prefers-reduced-motion: reduce)': paperlight.motionReduced,
    },
    transitionProperty: 'background-color, border-color, color, transform',
    transitionTimingFunction: paperlight.easeOut,
    ':focus-visible': {
      outlineColor: paperlight.focus,
      outlineOffset: 3,
      outlineStyle: 'solid',
      outlineWidth: 2,
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
  actionPrimary: {
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
  actionSecondary: {
    backgroundColor: paperlight.surface,
    borderColor: paperlight.borderStrong,
    color: paperlight.ink,
    '@media (hover: hover)': {
      ':hover': {
        borderColor: paperlight.forest,
        color: paperlight.forest,
      },
    },
  },
  successFlourish: {
    animationName: successFlourishReveal,
    animationDuration: {
      default: paperlight.motionSlow,
      '@media (prefers-reduced-motion: reduce)': paperlight.motionReduced,
    },
    animationFillMode: 'both',
    animationTimingFunction: paperlight.easeOut,
    display: 'block',
    height: '4.5rem',
    margin: 0,
    transformOrigin: 'center',
    width: '6rem',
  },
  successFlourishStroke: {
    fill: 'none',
    stroke: paperlight.forest,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2.5,
  },
  successFlourishLeaf: {
    fill: paperlight.moss,
  },
  successFlourishLeafAccent: {
    fill: paperlight.ochre,
  },
  successFlourishSeed: {
    fill: paperlight.ink,
  },
  successFlourishSeedMark: {
    fill: 'none',
    stroke: paperlight.canvas,
    strokeLinecap: 'round',
    strokeWidth: 3,
  },
  checkoutPage: {
    maxWidth: '64rem',
    minWidth: 0,
  },
  checkoutMain: {
    paddingBlock: paperlight.space8,
  },
  checkoutHeader: {
    display: 'grid',
    gap: paperlight.space3,
    maxWidth: '52rem',
    minWidth: 0,
  },
  checkoutKicker: {
    margin: 0,
  },
  checkoutTitle: {
    margin: 0,
  },
  checkoutStatus: {
    marginBlockEnd: paperlight.space6,
    marginBlockStart: paperlight.space6,
    maxWidth: '52rem',
    minWidth: 0,
  },
  checkoutSuccess: {
    display: 'grid',
    gap: paperlight.space4,
    '@media (min-width: 48rem)': {
      gap: paperlight.space8,
      gridTemplateColumns: 'minmax(0, 0.75fr) minmax(0, 1.25fr)',
    },
    minWidth: 0,
  },
  checkoutIntro: {
    alignContent: 'start',
    display: 'grid',
    gap: paperlight.space4,
    minWidth: 0,
  },
  checkoutLead: {
    margin: 0,
  },
  checkoutMeta: {
    borderBlockColor: paperlight.border,
    borderBlockStyle: 'solid',
    borderBlockWidth: 1,
    display: 'grid',
    gap: paperlight.space3,
    margin: 0,
    paddingBlock: paperlight.space4,
  },
  checkoutMetaItem: {
    display: 'grid',
    gap: paperlight.space1,
    minWidth: 0,
  },
  checkoutMetaValue: {
    lineHeight: 1.45,
    margin: 0,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  checkoutDetails: {
    display: 'grid',
    gap: paperlight.space4,
    minWidth: 0,
    '@media (min-width: 48rem)': {
      gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
      alignItems: 'start',
    },
  },
  checkoutPending: {
    margin: 0,
  },
  checkoutActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: paperlight.space3,
    marginTop: paperlight.space6,
    minWidth: 0,
    '@media (max-width: 43.99rem)': {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  checkoutAction: {
    maxWidth: '100%',
    minWidth: 0,
    whiteSpace: 'nowrap',
    '@media (max-width: 43.99rem)': {
      width: '100%',
    },
  },
  docsTitle: {
    overflowWrap: 'anywhere',
  },
  docsProse: {
    minWidth: 0,
  },
  docsApiItem: {
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  supportContent: {
    minWidth: 0,
  },
  supportIntro: {
    display: 'grid',
    gap: paperlight.space3,
    minWidth: 0,
  },
  supportHeading: {
    margin: 0,
  },
  supportComposer: {
    minWidth: 0,
    width: '100%',
  },
  link: {
    color: paperlight.forest,
    fontWeight: 600,
    textDecorationThickness: '0.08em',
    textUnderlineOffset: '0.18em',
  },
  chip: {
    alignItems: 'center',
    backgroundColor: paperlight.surface,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusRound,
    borderStyle: 'solid',
    borderWidth: 1,
    color: paperlight.ink,
    cursor: 'pointer',
    display: 'inline-flex',
    fontFamily: paperlight.uiFont,
    fontSize: paperlight.textSm,
    justifyContent: 'center',
    minHeight: paperlight.touchTarget,
    paddingInline: paperlight.space4,
    transitionDuration: {
      default: paperlight.motionFast,
      '@media (prefers-reduced-motion: reduce)': paperlight.motionReduced,
    },
    transitionProperty: 'background-color, border-color, color, transform',
    transitionTimingFunction: paperlight.easeOut,
    ':focus-visible': {
      outlineColor: paperlight.focus,
      outlineOffset: 3,
      outlineStyle: 'solid',
      outlineWidth: 2,
    },
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
      opacity: 0.58,
    },
  },
  chipActive: {
    backgroundColor: paperlight.forest,
    borderColor: paperlight.forest,
    color: paperlight.onForest,
  },
  docsNav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: paperlight.space3,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  docsNavWrap: {
    marginTop: paperlight.space6,
  },
  apiList: {
    display: 'grid',
    gap: paperlight.space3,
    listStyle: 'none',
    marginBlock: `${paperlight.space8} ${paperlight.space4}`,
    padding: 0,
  },
  noResults: {
    color: paperlight.inkMuted,
    paddingBlock: paperlight.space12,
    textAlign: 'center',
  },
  breakAnywhere: {
    overflowWrap: 'anywhere',
  },
  homeProjects: {
    display: 'grid',
    gap: paperlight.space4,
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 17rem), 1fr))',
    minWidth: 0,
  },
  cadenceGrid: {
    display: 'grid',
    gap: paperlight.space6,
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    '@media (max-width: 54rem)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  projectCompose: {
    display: 'grid',
    gap: paperlight.space6,
    gridTemplateColumns: 'minmax(0, 2fr) minmax(16rem, 1fr)',
    '@media (max-width: 54rem)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  projectContent: {
    paddingBottom: paperlight.space12,
    paddingTop: paperlight.space2,
  },
  projectIdentity: {
    marginBottom: paperlight.space8,
  },
  projectActions: {
    marginTop: paperlight.space5,
  },
  projectSection: {
    marginBottom: paperlight.space10,
  },
  thanks: {
    backgroundColor: paperlight.canvasSubtle,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusLg,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: paperlight.space5,
  },
  thanksGrid: {
    display: 'grid',
    gap: paperlight.space4,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    '@media (max-width: 43.99rem)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  thanksNote: {
    backgroundColor: paperlight.surface,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusMd,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: paperlight.space4,
  },
  legalNote: {
    color: paperlight.inkMuted,
    fontSize: paperlight.textSm,
    marginTop: paperlight.space8,
  },
  projectTiers: {
    display: 'grid',
    gap: paperlight.space4,
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    '@media (max-width: 72rem)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    '@media (max-width: 43.99rem)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  projectFeed: {
    display: 'grid',
    gap: paperlight.space6,
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.9fr)',
    marginBottom: paperlight.space10,
    '@media (max-width: 72rem)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  update: {
    borderBottomColor: paperlight.border,
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    paddingBlock: paperlight.space4,
  },
});
