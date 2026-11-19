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

/** The layer tree's row geometry in pixels at the current interface size. */
export function useLayerTreeGeometry() {
  return {
    rowHeight: computed(() => remToPx(ROW_HEIGHT_REM)),
    indent: computed(() => remToPx(INDENT_REM)),
    nameStart: computed(() => remToPx(NAME_START_REM)),
    buttons: computed(() => remToPx(BUTTONS_REM))
  }
}
