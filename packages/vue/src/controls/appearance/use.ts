import { createAppearanceActions, createAppearanceState } from '#vue/controls/appearance/helpers'
import { useNodeProps } from '#vue/controls/node-props/use'
import { useEditor } from '#vue/editor/context'

/**
 * Returns appearance-related state and actions for the current selection.
 *
 * Use this composable for visibility, opacity, and corner-radius controls in
 * property panels.
 */
export function useAppearance() {
  const editor = useEditor()
  const { nodes, node, active, isMulti, merged, updateProp, commitProp } = useNodeProps()

  const appearanceState = createAppearanceState({ node, nodes, isMulti, merged })
  const appearanceActions = createAppearanceActions({ editor, node, nodes, isMulti, merged })

  return {
    editor,
    nodes,
    node,
    active,
    isMulti,
    ...appearanceState,
    updateProp,
    commitProp,
    ...appearanceActions
  }
}
