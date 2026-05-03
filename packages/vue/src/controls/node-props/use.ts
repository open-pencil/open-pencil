import {
  MIXED,
  createNodePropArrayActions,
  createNodePropScrubActions,
  createNodePropSelectionState,
  isNodeArrayMixed
} from '#vue/controls/node-props/helpers'
import { useEditor } from '#vue/editor/context'

/** Sentinel value returned when a property differs across multiple selected nodes. */
export { MIXED }

/** Property value that may either be concrete or mixed across the selection. */
export type { MixedValue } from '#vue/controls/node-props/helpers'

/**
 * Returns shared property-panel helpers for the current selection.
 *
 * This composable centralizes mixed-value detection, multi-selection updates,
 * array-item editing, and commit semantics used by higher-level controls.
 */
export function useNodeProps() {
  const store = useEditor()
  const { node, nodes, isMulti, active, activeNode, prop, merged, updateAllWithUndo } =
    createNodePropSelectionState(store)

  function isArrayMixed(key: Parameters<typeof isNodeArrayMixed>[1]): boolean {
    return isNodeArrayMixed(nodes.value, key)
  }

  const { targetNodes, updateArrayItem, removeArrayItem, toggleArrayVisibility } =
    createNodePropArrayActions({ store, nodes, activeNode, isMulti })

  const { updateProp, commitProp } = createNodePropScrubActions(store)

  return {
    store,
    node,
    nodes,
    isMulti,
    active,
    activeNode,
    targetNodes,
    prop,
    merged,
    updateAllWithUndo,
    updateArrayItem,
    removeArrayItem,
    toggleArrayVisibility,
    isArrayMixed,
    updateProp,
    commitProp
  }
}
