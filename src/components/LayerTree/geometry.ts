import { computed } from 'vue'

import { remToPx } from '@/app/shell/root-font-size'

// Virtualized offsets, both display/rename rows and the drop indicator must use the same geometry.
// It is in rem so the rows follow the interface size; scroll math and the virtualizer take pixels.
const ROW_HEIGHT_REM = 1.5
const INDENT_REM = 1
// Mirrors the `layer-tree` theme: a name follows the disclosure (w-4), a gap (gap-1), the icon
// (size-3), and a gap; the row ends with a gap (gap-1) and the trailing block's padding (pe-1),
// where an issue mark (size-4) and the buttons (two size-4, gap-0.5) sit apart by gap-1.
const NAME_START_REM = 2.25
const ROW_END_REM = 0.5
const TRAILING_GAP_REM = 0.25
const ISSUE_MARK_REM = 1
const BUTTONS_REM = 2.125
// A variable mode badge after a name: its gap (gap-1.5), its padding (px-1.5) and 1px border,
// and its text (text-3xs).
const BADGE_GAP_REM = 0.375
const BADGE_PADDING_REM = 0.75
const BADGE_BORDER_PX = 2
const BADGE_TEXT_REM = 0.625

/** The layer tree's row geometry in pixels at the current interface size. */
export function useLayerTreeGeometry() {
  return {
    rowHeight: computed(() => remToPx(ROW_HEIGHT_REM)),
    indent: computed(() => remToPx(INDENT_REM)),
    nameStart: computed(() => remToPx(NAME_START_REM)),
    rowEnd: computed(() => remToPx(ROW_END_REM)),
    trailingGap: computed(() => remToPx(TRAILING_GAP_REM)),
    issueMark: computed(() => remToPx(ISSUE_MARK_REM)),
    buttons: computed(() => remToPx(BUTTONS_REM)),
    /** Space a variable mode badge takes besides its text. */
    badge: computed(() => remToPx(BADGE_GAP_REM + BADGE_PADDING_REM) + BADGE_BORDER_PX),
    badgeTextSize: computed(() => remToPx(BADGE_TEXT_REM))
  }
}
