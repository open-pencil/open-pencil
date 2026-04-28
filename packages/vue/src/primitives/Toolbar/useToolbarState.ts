import { computed, ref } from 'vue'

import type { Tool, EditorToolDef } from '@open-pencil/core/editor'

const CATEGORY_COUNT = 3

/**
 * Returns responsive toolbar UI state for mobile category paging.
 *
 * This composable is presentation-oriented and complements {@link useToolbar}
 * when building toolbar shells.
 */
export function useToolbarState() {
  const mobileCategory = ref(0)
  const slideDirection = ref(1)

  const hasPrev = computed(() => mobileCategory.value > 0)
  const hasNext = computed(() => mobileCategory.value < CATEGORY_COUNT - 1)

  function isActive(tool: EditorToolDef, activeTool: Tool): boolean {
    if (tool.key === activeTool) return true
    return tool.flyout?.includes(activeTool) ?? false
  }

  function activeKeyForTool(tool: EditorToolDef, activeTool: Tool): Tool {
    if (tool.flyout?.includes(activeTool)) return activeTool
    return tool.key
  }

  function goPrev() {
    if (!hasPrev.value) return
    slideDirection.value = -1
    mobileCategory.value--
  }

  function goNext() {
    if (!hasNext.value) return
    slideDirection.value = 1
    mobileCategory.value++
  }

  return {
    mobileCategory,
    slideDirection,
    hasPrev,
    hasNext,
    isActive,
    activeKeyForTool,
    goPrev,
    goNext
  }
}
