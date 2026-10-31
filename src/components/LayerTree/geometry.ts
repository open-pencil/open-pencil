import { computed } from 'vue'

import { interfaceScaleFactor } from '@/app/shell/interface-scale'

// Virtualized offsets and both display/rename rows must use the same geometry.
export const LAYER_TREE_ROW_HEIGHT = 24

export function layerTreeGeometry() {
  return {
    rowHeight: computed(() => LAYER_TREE_ROW_HEIGHT * interfaceScaleFactor()),
    indent: computed(() => 16 * interfaceScaleFactor())
  }
}
