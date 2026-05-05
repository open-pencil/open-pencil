import { computed } from 'vue'

import { DEFAULT_FONT_FAMILY } from '@open-pencil/core/constants'
import { fontManager } from '@open-pencil/core/text'

import type { SceneNode } from '@open-pencil/core/scene-graph'

/**
 * Returns missing-font information for a text node getter.
 *
 * This is useful for typography panels and warnings that need to surface fonts
 * that are referenced by a node but not yet loaded in the current runtime.
 */
export function useNodeFontStatus(node: () => SceneNode | null | undefined) {
  const missingFonts = computed(() => {
    const n = node()
    if (n?.type !== 'TEXT') return []

    const families = new Set<string>()
    families.add(n.fontFamily || DEFAULT_FONT_FAMILY)
    for (const run of n.styleRuns) {
      if (run.style.fontFamily) families.add(run.style.fontFamily)
    }

    return [...families].filter((f) => !fontManager.isLoaded(f))
  })

  const hasMissingFonts = computed(() => missingFonts.value.length > 0)

  return { missingFonts, hasMissingFonts }
}
