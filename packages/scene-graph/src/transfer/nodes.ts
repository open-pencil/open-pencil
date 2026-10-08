import { cloneNodeProps } from '../copy'
import { remapInstanceOverrideState } from '../instance-overrides'
import type { ComponentPropertyType, SceneNode } from '../types'
import { requireTransferReference as required } from './references'
import type { VariableTransferReferences } from './variables'

export function semanticTransferReferences(node: SceneNode): string[] {
  return [
    ...(node.componentId ? [node.componentId] : []),
    ...Object.values(node.boundVariables),
    ...[
      node.fillStyleId,
      node.strokeStyleId,
      node.textStyleId,
      node.effectStyleId,
      node.gridStyleId
    ].filter((id): id is string => !!id),
    ...node.fillGeometry.flatMap((path) => (path.fillStyleId ? [path.fillStyleId] : [])),
    ...node.strokeGeometry.flatMap((path) => (path.fillStyleId ? [path.fillStyleId] : [])),
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
        field.startsWith('boundVariables/'))
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
  for (const paths of [result.fillGeometry, result.strokeGeometry]) {
    for (const path of paths ?? []) if (path.fillStyleId) path.fillStyleId = style(path.fillStyleId)
  }
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
