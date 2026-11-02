import { cloneNodeProps } from '../copy'
import { overriddenBindingField, remapInstanceOverrideState } from '../instances/overrides'
import { referencedStyleIds } from '../shared-styles'
import { remapStyleRunReferences, styleRunReferences } from '../text/references'
import type { ComponentPropertyType, SceneNode } from '../types'
import { requireTransferReference as required } from './references'
import type { VariableTransferReferences } from './variables'

export function semanticTransferReferences(node: SceneNode): string[] {
  const runs = styleRunReferences(node.styleRuns)
  return [
    ...(node.componentId ? [node.componentId] : []),
    ...Object.values(node.boundVariables),
    ...runs.variables,
    ...referencedStyleIds(node),
    ...Object.entries(node.componentPropertyAssignments).flatMap(([id, value]) => [id, value]),
    ...node.componentPropertyReferences.map((reference) => reference.propertyId),
    ...node.componentPropertyDefinitions.flatMap((definition) => [
      definition.id,
      ...(definition.type === 'INSTANCE_SWAP' && definition.defaultValue
        ? [definition.defaultValue]
        : [])
    ]),
    ...node.instanceOverrides.descendants.keys(),
    ...[
      ...node.instanceOverrides.self,
      ...[...node.instanceOverrides.descendants.values()].flatMap((fields) => [...fields])
    ].flatMap(([field, value]) =>
      typeof value === 'string' &&
      (field === 'componentId' ||
        field === 'sourceComponentId' ||
        overriddenBindingField(field) !== null)
        ? [value]
        : []
    )
  ]
}

export interface NodeTransferReferences extends VariableTransferReferences {
  nodes: ReadonlyMap<string, string>
  styles: ReadonlyMap<string, string>
  properties: ReadonlyMap<string, string>
  propertyTypes: ReadonlyMap<string, ComponentPropertyType>
}

/** Prepare runtime references without rewriting original format identities or ordinary text. */
export function prepareNodeTransfer(
  source: SceneNode,
  refs: NodeTransferReferences
): Partial<SceneNode> {
  const node = (id: string) => required(refs.nodes, id, 'node')
  const variable = (id: string) => required(refs.variables, id, 'variable')
  const property = (id: string) => required(refs.properties, id, 'property')
  const style = (id: string) => required(refs.styles, id, 'style')
  const propertyValue = (id: string, value: string): string => {
    const type = refs.propertyTypes.get(id)
    if (!type) throw new Error(`Missing property transfer type: ${id}`)
    return type === 'INSTANCE_SWAP' && value ? node(value) : value
  }
  const values = (entries: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(entries).map(([id, value]) => [property(id), propertyValue(id, value)])
    )
  const result = cloneNodeProps(source, null)
  result.componentId = source.componentId ? node(source.componentId) : null
  result.instanceOverrides = remapInstanceOverrideState(source.instanceOverrides, {
    node,
    variable
  })
  result.boundVariables = Object.fromEntries(
    Object.entries(source.boundVariables).map(([field, id]) => [field, variable(id)])
  )
  result.variableModes = Object.fromEntries(
    Object.entries(source.variableModes).map(([collection, mode]) => [
      required(refs.collections, collection, 'collection'),
      required(refs.modes, mode, 'mode')
    ])
  )
  for (const field of [
    'fillStyleId',
    'strokeStyleId',
    'textStyleId',
    'effectStyleId',
    'gridStyleId'
  ] as const) {
    result[field] = source[field] ? style(source[field]) : null
  }
  if (result.styleRuns) {
    // A link to a layer the transfer leaves behind keeps naming it.
    result.styleRuns = remapStyleRunReferences(result.styleRuns, {
      variable,
      style,
      node: (id) => refs.nodes.get(id) ?? id
    })
  }
  // A connector keeps the layers it was attached to when they are left behind; the end becomes
  // free where nothing by that ID exists, as a pasted Figma connector does.
  for (const field of ['connectorStart', 'connectorEnd'] as const) {
    const endpoint = result[field]
    if (endpoint?.nodeId) endpoint.nodeId = refs.nodes.get(endpoint.nodeId) ?? endpoint.nodeId
  }
  for (const region of result.vectorNetwork?.regions ?? [])
    if (region.fillStyleId) region.fillStyleId = style(region.fillStyleId)
  result.componentPropertyDefinitions = source.componentPropertyDefinitions.map((definition) => ({
    ...structuredClone(definition),
    id: property(definition.id),
    defaultValue: propertyValue(definition.id, definition.defaultValue)
  }))
  result.componentPropertyReferences = source.componentPropertyReferences.map((reference) => ({
    ...reference,
    propertyId: property(reference.propertyId)
  }))
  result.componentPropertyAssignments = values(source.componentPropertyAssignments)
  // Variant values are keyed by display names, unlike definition-ID assignments.
  result.componentPropertyValues = { ...source.componentPropertyValues }
  return result
}
