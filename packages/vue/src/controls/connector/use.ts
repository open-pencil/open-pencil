import { computed } from 'vue'

import type { ConnectorLineType, SceneNode, StrokeCap } from '@open-pencil/scene-graph'
import {
  CONNECTOR_THICK_STROKE_WEIGHT,
  connectorLineStyle,
  connectorSublayers
} from '@open-pencil/scene-graph/connectors'
import { figJamColorName, type FigJamColorName } from '@open-pencil/scene-graph/figjam'

import { useEditor } from '#vue/editor/context'
import { useSelectionState } from '#vue/editor/selection-state/use'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

/**
 * Headless state and actions for selected connectors: their line type, the caps at their ends,
 * and their line's FigJam colour, weight and dash. A selection of several connectors reads its first and edits them all.
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
  const lineStyle = useSceneComputed(() => {
    const first = connectors.value.at(0)
    const line = first && connectorSublayers(editor.graph, first)?.line
    return line ? connectorLineStyle(line) : null
  })
  const color = computed<FigJamColorName | null>(() => figJamColorName(lineStyle.value?.color))
  const thick = computed(() => (lineStyle.value?.weight ?? 0) >= CONNECTOR_THICK_STROKE_WEIGHT)
  const dashed = computed(() => lineStyle.value?.dashed ?? false)

  function setLineType(value: ConnectorLineType) {
    editor.setConnectorLineType(ids.value, value)
  }

  function setStartCap(value: StrokeCap) {
    editor.setConnectorCap(ids.value, 'start', value)
  }

  function setEndCap(value: StrokeCap) {
    editor.setConnectorCap(ids.value, 'end', value)
  }

  function setColor(value: FigJamColorName) {
    editor.setConnectorColor(ids.value, value)
  }

  function setThick(value: boolean) {
    editor.setConnectorThick(ids.value, value)
  }

  function setDashed(value: boolean) {
    editor.setConnectorDashed(ids.value, value)
  }

  return {
    active,
    lineType,
    startCap,
    endCap,
    color,
    thick,
    dashed,
    setLineType,
    setStartCap,
    setEndCap,
    setColor,
    setThick,
    setDashed
  }
}
