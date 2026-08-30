/* Hallmark · admin workbench surfaces · restrained utility, clear evidence hierarchy */

import * as stylex from '@stylexjs/stylex';
import { paperlight } from '@oss-tips/design-tokens/paperlight.stylex';

export const admin = stylex.create({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: paperlight.space6,
    minWidth: 0,
  },
  operatorBar: {
    alignItems: 'baseline',
    backgroundColor: paperlight.surface,
    borderColor: paperlight.info,
    borderRadius: paperlight.radiusMd,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: `${paperlight.space1} ${paperlight.space4}`,
    paddingBlock: paperlight.space3,
    paddingInline: paperlight.space4,
  },
  operatorBarWarning: {
    borderColor: paperlight.ochre,
  },
  operatorBarDanger: {
    borderColor: paperlight.danger,
  },
  operatorContext: {
    color: paperlight.ink,
    fontFamily: paperlight.uiFont,
    fontSize: '0.9375rem',
    fontWeight: 600,
    margin: 0,
  },
  operatorDetail: {
    color: paperlight.inkMuted,
    flexBasis: '100%',
    fontFamily: paperlight.uiFont,
    fontSize: '0.875rem',
    margin: 0,
  },
  toolbar: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: paperlight.space3,
    justifyContent: 'space-between',
  },
  row: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: paperlight.space3,
  },
  grid2: {
    display: 'grid',
    gap: paperlight.space6,
    gridTemplateColumns: 'minmax(0, 1fr)',
    '@media (min-width: 90rem)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  },
  grid3: {
    display: 'grid',
    gap: paperlight.space4,
    gridTemplateColumns: 'minmax(0, 1fr)',
    '@media (min-width: 44rem)': {
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    },
  },
  surface: {
    backgroundColor: paperlight.surface,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusLg,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: paperlight.space5,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: paperlight.space3,
    minWidth: 0,
  },
  sectionHeading: {
    color: paperlight.ink,
    fontFamily: paperlight.uiFont,
    fontSize: '1.125rem',
    fontWeight: 600,
    margin: 0,
  },
  tableWrap: {
    maxWidth: '100%',
    overflowX: 'auto',
  },
  footnote: {
    color: paperlight.inkMuted,
    fontSize: '0.875rem',
    margin: 0,
  },
  select: {
    appearance: 'none',
    backgroundColor: paperlight.surface,
    borderColor: paperlight.borderStrong,
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
  },
  state: {
    alignItems: 'flex-start',
    backgroundColor: paperlight.surface,
    borderColor: paperlight.border,
    borderRadius: paperlight.radiusLg,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: paperlight.space3,
    padding: paperlight.space6,
  },
  stateTitle: {
    color: paperlight.ink,
    fontFamily: paperlight.uiFont,
    fontSize: '1.125rem',
    fontWeight: 600,
    margin: 0,
  },
  stateMessage: {
    color: paperlight.inkMuted,
    margin: 0,
    maxWidth: '42rem',
  },
});
