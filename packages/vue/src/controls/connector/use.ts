import { computed } from 'vue'

import type { ConnectorLineType, SceneNode, StrokeCap } from '@open-pencil/scene-graph'

import { useEditor } from '#vue/editor/context'
import { useSelectionState } from '#vue/editor/selection-state/use'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

/**
 * Headless state and actions for selected connectors: their line type and the caps at their
 * ends. A selection of several connectors reads its first and edits them all.
 */
export function useConnector() {
  const editor = useEditor()
  const { selectedIds } = useSelectionState()

  const connectors = useSceneComputed(() => {
    const nodes = [...selectedIds.value].map((id) => editor.graph.getNode(id))
    return nodes.length > 0 && nodes.every((node) => node?.type === 'CONNECTOR')
      ? nodes.filter((node): node is SceneNode => node !== undefined)
      : []
  })
  const active = computed(() => connectors.value.length > 0)
  const ids = computed(() => connectors.value.map((connector) => connector.id))
  // Each reads the list itself: the first connector stays the same object as it changes.
  const lineType = computed<ConnectorLineType | null>(
    () => connectors.value.at(0)?.connectorLineType ?? null
  )
  const startCap = computed<StrokeCap | null>(
    () => connectors.value.at(0)?.connectorStartCap ?? null
  )
  const endCap = computed<StrokeCap | null>(() => connectors.value.at(0)?.connectorEndCap ?? null)

  function setLineType(value: ConnectorLineType) {
    editor.setConnectorLineType(ids.value, value)
  }

  function setStartCap(value: StrokeCap) {
    editor.setConnectorCap(ids.value, 'start', value)
  }

  function setEndCap(value: StrokeCap) {
    editor.setConnectorCap(ids.value, 'end', value)
  }

  return { active, lineType, startCap, endCap, setLineType, setStartCap, setEndCap }
}
