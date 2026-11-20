import { computed } from 'vue'

import { remToPx } from '@/app/shell/root-font-size'

// Virtualized offsets, both display/rename rows and the drop indicator must use the same geometry.
// It is in rem so the rows follow the interface size; scroll math and the virtualizer take pixels.
const ROW_HEIGHT_REM = 1.5
const INDENT_REM = 1

const rowPartRem = {
  '--layer-row-gap': 0.25,
  '--layer-row-disclosure': 1,
  '--layer-row-icon': 0.75,
  '--layer-row-issue-mark': 1,
  '--layer-row-action': 1,
  '--layer-row-action-gap': 0.125,
  '--layer-row-badge-gap': 0.375,
  '--layer-row-badge-padding': 0.375,
  '--layer-row-badge-text': 0.625
} as const

const BADGE_BORDER_PX = 1

export const layerRowPartSizes: Record<string, string> = {
  ...Object.fromEntries(Object.entries(rowPartRem).map(([name, rem]) => [name, `${rem}rem`])),
  '--layer-row-badge-border': `${BADGE_BORDER_PX}px`
}

/** The layer tree's row geometry in pixels at the current interface size. */
export function useLayerTreeGeometry() {
  return {
    rowHeight: computed(() => remToPx(ROW_HEIGHT_REM)),
    indent: computed(() => remToPx(INDENT_REM)),
    nameStart: computed(() =>
      remToPx(
        rowPartRem['--layer-row-disclosure'] +
          rowPartRem['--layer-row-icon'] +
          2 * rowPartRem['--layer-row-gap']
      )
    ),
    /** After the trailing block's last part: its end padding and the row's gap before it. */
    rowEnd: computed(() => remToPx(2 * rowPartRem['--layer-row-gap'])),
    trailingGap: computed(() => remToPx(rowPartRem['--layer-row-gap'])),
    issueMark: computed(() => remToPx(rowPartRem['--layer-row-issue-mark'])),
    buttons: computed(() =>
      remToPx(2 * rowPartRem['--layer-row-action'] + rowPartRem['--layer-row-action-gap'])
    ),
    /** Space a variable mode badge takes besides its text. */
    badge: computed(
      () =>
        remToPx(rowPartRem['--layer-row-badge-gap'] + 2 * rowPartRem['--layer-row-badge-padding']) +
        2 * BADGE_BORDER_PX
    ),
    badgeTextSize: computed(() => remToPx(rowPartRem['--layer-row-badge-text']))
  }
}
