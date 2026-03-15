import { computed } from 'vue'

import { isFontLoaded, DEFAULT_FONT_FAMILY } from '@verso/core'

import type { SceneNode } from '@verso/core'

export function useNodeFontStatus(node: () => SceneNode) {
  const missingFonts = computed(() => {
    const n = node()
    if (n.type !== 'TEXT') return []

    const families = new Set<string>()
    families.add(n.fontFamily || DEFAULT_FONT_FAMILY)
    for (const run of n.styleRuns) {
      if (run.style.fontFamily) families.add(run.style.fontFamily)
    }

    return [...families].filter((f) => !isFontLoaded(f))
  })

  const hasMissingFonts = computed(() => missingFonts.value.length > 0)

  return { missingFonts, hasMissingFonts }
}
