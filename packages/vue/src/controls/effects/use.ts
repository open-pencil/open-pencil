import {
  EFFECT_OPTIONS,
  createDefaultEffect,
  createEffectControlActions,
  createEffectEditActions,
  isShadow
} from '#vue/controls/effects/helpers'
import { useEditor } from '#vue/editor/context'
import { ref } from 'vue'

import type { Effect } from '@open-pencil/core/scene-graph'

/**
 * Returns effect-editing helpers for property panels.
 *
 * This composable manages default effect creation, expanded-row state,
 * scrub-preview behavior, and effect type/color updates.
 */
export function useEffectsControls() {
  const editor = useEditor()

  const expandedIndex = ref<number | null>(null)
  const effectsBeforeScrub = ref<Effect[] | null>(null)
  const editActions = createEffectEditActions(editor, effectsBeforeScrub)
  const controlActions = createEffectControlActions(expandedIndex)

  return {
    expandedIndex,
    effectOptions: EFFECT_OPTIONS,
    createDefaultEffect,
    isShadow,
    ...editActions,
    ...controlActions
  }
}
