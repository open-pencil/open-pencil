import type { SceneGraph, SceneNode, VariableModeMap } from '@open-pencil/scene-graph'
import { isRecord } from '@open-pencil/std/records'

import { prepareScalarBindings } from '../overrides/scalar-bindings'
import { isVariable } from '../variables'
import {
  bindVariableProp,
  requireVariableId,
  resolveForLayer,
  type LayerContext
} from '../variables/graph'
import { paintProps } from '../variables/props'

export interface PreparedProps {
  props: Record<string, unknown>
  bindings: Record<string, string>
}

export function preparePropsForRender(
  graph: SceneGraph,
  source: Record<string, unknown>,
  isText: boolean,
  layer: LayerContext
): PreparedProps {
  const props = { ...source }
  const bindings: Record<string, string> = {}

  if (Array.isArray(props.fills)) {
    props.fills = props.fills.map((value: unknown, index) => {
      const fill = { value }
      bindVariableProp(graph, fill, bindings, 'value', `fills/${index}/color`, layer)
      return fill.value
    })
  }

  for (const { prop, fields } of paintProps({ text: isText })) {
    bindVariableProp(graph, props, bindings, prop, fields[0], layer)
  }

  if (isRecord(props.style)) {
    const style = { ...props.style }
    for (const key of ['background', 'backgroundColor']) {
      bindVariableProp(graph, style, bindings, key, 'fills/0/color', layer)
    }
    if (isText) bindVariableProp(graph, style, bindings, 'color', 'fills/0/color', layer)
    bindVariableProp(graph, style, bindings, 'borderColor', 'strokes/0/color', layer)
    props.style = style
  }

  prepareScalarBindings(graph, props, bindings, isText, (variableId) =>
    resolveForLayer(graph, variableId, layer.parentId, layer.modes)
  )

  if (isRecord(props.bind)) {
    for (const [field, value] of Object.entries(props.bind)) {
      if (isVariable(value)) {
        bindings[field] = requireVariableId(graph, value)
      } else if (typeof value === 'string') {
        bindings[field] = value
      }
    }
  }

  return { props, bindings }
}

export function applyBindings(
  graph: SceneGraph,
  nodeId: string,
  bindings: Record<string, string>
): void {
  for (const [field, variableId] of Object.entries(bindings)) {
    graph.bindVariable(nodeId, field, variableId)
  }
}

/** The modes a layer pins and the component properties its fields are bound to. */
export function layerMetadata(
  modes: VariableModeMap | undefined,
  references: SceneNode['componentPropertyReferences']
): Partial<SceneNode> {
  return {
    ...(modes && { variableModes: modes }),
    ...(references.length > 0 && { componentPropertyReferences: references })
  }
}
