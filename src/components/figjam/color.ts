import { computed } from 'vue'

import { figJamColor, type FigJamColorName } from '@open-pencil/scene-graph/figjam'
import { useColorCSS } from '@open-pencil/vue/controls/color-model'

/** The CSS showing FigJam palette colour `name()` as the canvas draws it, or none without one. */
export function useFigJamColorCSS(name: () => FigJamColorName | null | undefined) {
  const colorCSS = useColorCSS()
  return computed(() => {
    const current = name()
    return current ? colorCSS(figJamColor(current)) : undefined
  })
}
