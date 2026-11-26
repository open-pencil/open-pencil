import { computed } from 'vue'

import { remToPx } from '@/app/shell/root-font-size'

// Virtualized offsets, both display/rename rows and the drop indicator must use the same geometry.
// It is in rem so the rows follow the interface size; scroll math and the virtualizer take pixels.
const ROW_HEIGHT_REM = 1.5
const INDENT_REM = 1
// Mirrors the `layer-tree` theme: a name follows the disclosure (w-4), a gap (gap-1), the icon
// (size-3), and a gap; the end holds a gap, two buttons (size-4, gap-0.5), and padding (pe-1).
const NAME_START_REM = 2.25
const BUTTONS_REM = 2.625
// A variable mode badge after a name: its gap (gap-1.5), its padding (px-1.5) and 1px border,
// and its text (text-3xs). An issue mark adds its size (size-4) and a gap before the buttons.
const BADGE_GAP_REM = 0.375
const BADGE_PADDING_REM = 0.75
const BADGE_BORDER_PX = 2
const BADGE_TEXT_REM = 0.625
const ISSUE_MARK_REM = 1.25

/** The layer tree's row geometry in pixels at the current interface size. */
export function useLayerTreeGeometry() {
  return {
    rowHeight: computed(() => remToPx(ROW_HEIGHT_REM)),
    indent: computed(() => remToPx(INDENT_REM)),
    nameStart: computed(() => remToPx(NAME_START_REM)),
    buttons: computed(() => remToPx(BUTTONS_REM)),
    /** Space a variable mode badge takes besides its text. */
    badge: computed(() => remToPx(BADGE_GAP_REM + BADGE_PADDING_REM) + BADGE_BORDER_PX),
    badgeTextSize: computed(() => remToPx(BADGE_TEXT_REM)),
    issueMark: computed(() => remToPx(ISSUE_MARK_REM))
  }
}
