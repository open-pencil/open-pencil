import { ref, shallowRef } from 'vue'

import {
  effectOptions,
  createDefaultEffect,
  effectOptionsFor,
  createEffectControlActions,
  createEffectEditActions,
  blurKindChange,
  grainSizeChange,
  isBlur,
  noiseTypeChange,
  isShadow,
  type EffectChange,
  type EffectEditSnapshot
} from '#vue/controls/effects/helpers'
import { useNodeProps } from '#vue/controls/node-props/use'
import { useEditor } from '#vue/editor/context'

/**
 * Returns effect-editing helpers for property panels.
 *
 * This composable manages default effect creation, expanded-row state,
 * scrub-preview behavior, and effect type/color updates.
 */
export function useEffectsControls() {
  const editor = useEditor()

  const expandedIndex = ref<number | null>(null)
  const { nodes } = useNodeProps()
  const effectsBeforeScrub = shallowRef<Map<string, EffectEditSnapshot> | null>(null)
  const editActions = createEffectEditActions(editor, effectsBeforeScrub)
  const controlActions = createEffectControlActions(expandedIndex)

  return {
    expandedIndex,
    /** The effect types, labelled in the current language. */
    get effectOptions() {
      return effectOptions()
    },
    effectOptionsFor,
    createDefaultEffect,
    isShadow,
    isBlur,
    blurKindChange,
    noiseTypeChange,
    grainSizeChange,
    /** Previews a change to one effect on every selected layer. */
    scrubEffect: (index: number, changes: EffectChange) =>
      editActions.scrubEffect(nodes.value, index, changes),
    /** Applies a change to one effect on every selected layer in one undo step. */
    commitEffect: (index: number, changes: EffectChange) =>
      editActions.commitEffect(nodes.value, index, changes),
    ...controlActions
  }
}
