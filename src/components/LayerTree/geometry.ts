import { computed } from 'vue'

import { remToPx } from '@/app/shell/root-font-size'

// Virtualized offsets, both display/rename rows and the drop indicator must use the same geometry.
// It is in rem so the rows follow the interface size; scroll math and the virtualizer take pixels.
const ROW_HEIGHT_REM = 1.5
const INDENT_REM = 1

/** The layer tree's row height and per-level indent in pixels at the current interface size. */
export function useLayerTreeGeometry() {
  return {
    rowHeight: computed(() => remToPx(ROW_HEIGHT_REM)),
    indent: computed(() => remToPx(INDENT_REM))
  }
}
