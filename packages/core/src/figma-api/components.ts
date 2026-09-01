import type {
  ComponentPropertyDefinition,
  ComponentPropertyType,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'
import {
  applyComponentPropertyValue,
  componentPropertyDefinitions as sharedComponentPropertyDefinitions,
  removeComponentProperty
} from '@open-pencil/scene-graph'
import { computeAbsoluteBounds } from '@open-pencil/scene-graph/geometry'
import { deriveSlashVariantProperties } from '@open-pencil/scene-graph/variant-properties'

import { randomHex } from '#core/random'

import type { NodeProxyInternals, ProxyThis } from './accessor-utils'
import { graph, raw, updateNode } from './accessor-utils'
import type { FigmaNodeProxy } from './proxy'

type InstanceSwapPreferredValue = { type: 'COMPONENT' | 'COMPONENT_SET'; key: string }

const COMPONENT_SET_PADDING = 40

interface FigmaComponentPropertyDefinition {
  type: ComponentPropertyType
  defaultValue: string | boolean
  preferredValues?: InstanceSwapPreferredValue[]
  variantOptions?: string[]
}

interface FigmaComponentProperty {
  type: ComponentPropertyType
  value: string | boolean
  preferredValues?: InstanceSwapPreferredValue[]
  variantOptions?: string[]
}

interface FigmaComponentProperties {
  [propertyName: string]: FigmaComponentProperty
}

export function exposeInstanceSwap(
  graph: SceneGraph,
  slots: ReadonlyArray<FigmaNodeProxy>,
  candidates: ReadonlyArray<FigmaNodeProxy>,
  propertyName = 'Instance'
): SceneNode {
  if (slots.length === 0) throw new Error('Provide at least one instance to expose')
  if (candidates.length === 0) throw new Error('Provide at least one candidate component')
  const name = propertyName.trim()
  if (!name) throw new Error('Property name must not be empty')
  const slotNodes = slots.map((slot) => graph.getNode(slot.id))
  if (new Set(slotNodes.map((node) => node?.id)).size !== slotNodes.length)
    throw new Error('exposeInstanceSwap requires distinct INSTANCE nodes')
  if (!slotNodes.every((node): node is SceneNode => node?.type === 'INSTANCE'))
    throw new Error('exposeInstanceSwap requires INSTANCE nodes')
  if (
    slotNodes.some((node) =>
      node.componentPropertyReferences.some((ref) => ref.field === 'INSTANCE_SWAP')
    )
  )
    throw new Error('Instance already has an INSTANCE_SWAP property')
  const candidateNodes = candidates.map((candidate) => graph.getNode(candidate.id))
  if (
    !candidateNodes.every(
      (node): node is SceneNode => node?.type === 'COMPONENT' || node?.type === 'COMPONENT_SET'
    )
  )
    throw new Error('Candidates must be COMPONENT or COMPONENT_SET nodes')
  const candidateIds = [...new Set(candidateNodes.map((node) => node.id))]
  if (candidateIds.length !== candidateNodes.length) throw new Error('Candidates must be distinct')
  const host = findPropertyHost(graph, slotNodes[0].parentId)
  if (!host) throw new Error('Instance must be nested inside a COMPONENT or COMPONENT_SET')
  if (host.componentPropertyDefinitions.some((definition) => definition.name === name))
    throw new Error(`A component property named "${name}" already exists`)
  if (!slotNodes.every((node) => findPropertyHost(graph, node.parentId)?.id === host.id))
    throw new Error('All instances must belong to the same component or component set')
  const definition: ComponentPropertyDefinition = {
    id: `prop:${randomHex(8)}`,
    name,
    type: 'INSTANCE_SWAP',
    defaultValue: slotNodes[0].componentId ?? candidateIds[0],
    preferredValues: candidateIds
  }
  graph.updateNode(host.id, {
    componentPropertyDefinitions: [...host.componentPropertyDefinitions, definition]
  })
  for (const node of slotNodes) {
    graph.updateNode(node.id, {
      componentPropertyReferences: [
        ...node.componentPropertyReferences,
        { propertyId: definition.id, field: 'INSTANCE_SWAP' }
      ]
    })
  }
  return host
}

function findPropertyHost(graph: SceneGraph, nodeId: string | null): SceneNode | null {
  let current = nodeId ? graph.getNode(nodeId) : null
  let fallback: SceneNode | null = null
  while (current) {
    if (current.type === 'COMPONENT_SET') return current
    if (current.type === 'COMPONENT' && !fallback) fallback = current
    current = current.parentId ? graph.getNode(current.parentId) : null
  }
  return fallback
}

function requireDistinctComponents(graph: SceneGraph, nodeIds: ReadonlyArray<string>): SceneNode[] {
  if (nodeIds.length === 0) throw new Error('Need at least 1 component to combine as variants')
  if (new Set(nodeIds).size !== nodeIds.length) {
    throw new Error('combineAsVariants requires distinct COMPONENT nodes')
  }

  const nodes = nodeIds.map((id) => graph.getNode(id))
  if (!nodes.every((node): node is SceneNode => node?.type === 'COMPONENT')) {
    throw new Error('combineAsVariants requires COMPONENT nodes')
  }
  return nodes
}

function propertyName(definition: ComponentPropertyDefinition): string {
  return definition.type === 'VARIANT' ? definition.name : `${definition.name}#${definition.id}`
}

function preferredValues(graph: SceneGraph, ids: string[]): InstanceSwapPreferredValue[] {
  return ids.flatMap((id) => {
    const node = graph.getNode(id)
    return node && (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET')
      ? [{ type: node.type, key: node.componentKey ?? node.sourceLibraryKey ?? node.id }]
      : []
  })
}

function propertyMetadata(
  target: ProxyThis,
  internals: NodeProxyInternals,
  definition: ComponentPropertyDefinition,
  includeVariantOptions: boolean
): Pick<FigmaComponentPropertyDefinition, 'preferredValues' | 'variantOptions'> {
  const metadata: Pick<FigmaComponentPropertyDefinition, 'preferredValues' | 'variantOptions'> = {}
  if (definition.preferredValues) {
    metadata.preferredValues = preferredValues(graph(target, internals), definition.preferredValues)
  }
  if (includeVariantOptions && definition.variantOptions) {
    metadata.variantOptions = [...definition.variantOptions]
  }
  return metadata
}
function definitions(
  target: ProxyThis,
  internals: NodeProxyInternals
): Record<string, FigmaComponentPropertyDefinition> {
  const node = raw(target, internals)
  if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') return {}
  return Object.fromEntries(
    node.componentPropertyDefinitions.map((definition) => [
      propertyName(definition),
      {
        type: definition.type,
        defaultValue:
          definition.type === 'BOOLEAN'
            ? definition.defaultValue === 'true'
            : definition.defaultValue,
        ...propertyMetadata(target, internals, definition, true)
      }
    ])
  )
}

function componentProperties(
  target: ProxyThis,
  internals: NodeProxyInternals
): FigmaComponentProperties {
  const node = raw(target, internals)
  if (node.type !== 'INSTANCE') return {}
  return Object.fromEntries(
    sharedComponentPropertyDefinitions(graph(target, internals), node).map((definition) => {
      const value = node.componentPropertyAssignments[definition.id] ?? definition.defaultValue
      return [
        propertyName(definition),
        {
          type: definition.type,
          value: definition.type === 'BOOLEAN' ? value === 'true' : value,
          ...propertyMetadata(target, internals, definition, false)
        }
      ]
    })
  )
}

function findDefinition(
  target: ProxyThis,
  internals: NodeProxyInternals,
  name: string
): ComponentPropertyDefinition | null {
  const node = raw(target, internals)
  const defs =
    node.type === 'INSTANCE'
      ? sharedComponentPropertyDefinitions(graph(target, internals), node)
      : node.componentPropertyDefinitions
  return (
    defs.find(
      (definition) =>
        propertyName(definition) === name ||
        (definition.type === 'VARIANT' && definition.name === name)
    ) ?? null
  )
}

function editPropertyDefinitions(
  target: ProxyThis,
  internals: NodeProxyInternals,
  propertyNameValue: string,
  changes: {
    name?: string
    defaultValue?: string | boolean
    preferredValues?: InstanceSwapPreferredValue[]
  }
): string {
  const node = raw(target, internals)
  if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')
    throw new Error('editComponentProperty() can only be called on components')
  const definition = findDefinition(target, internals, propertyNameValue)
  if (!definition) throw new Error(`Unknown component property: ${propertyNameValue}`)
  if (
    changes.defaultValue !== undefined &&
    !['BOOLEAN', 'TEXT', 'INSTANCE_SWAP'].includes(definition.type)
  ) {
    throw new Error(`defaultValue is not supported for ${definition.type} properties`)
  }
  const updatedName = changes.name?.trim()
  if (updatedName === '') throw new Error('Property name must not be empty')
  const updated: ComponentPropertyDefinition = { ...definition }
  if (updatedName) updated.name = updatedName
  if (changes.defaultValue !== undefined) {
    updated.defaultValue =
      definition.type === 'BOOLEAN'
        ? String(changes.defaultValue === true || changes.defaultValue === 'true')
        : String(changes.defaultValue)
  }
  if (changes.preferredValues) {
    updated.preferredValues = changes.preferredValues.map((value) => value.key)
  }
  updateNode(target, internals, {
    componentPropertyDefinitions: node.componentPropertyDefinitions.map((item) =>
      item.id === definition.id ? updated : item
    )
  })
  return propertyName(updated)
}
function propertyReferenceField(field: string): 'TEXT' | 'VISIBLE' | 'INSTANCE_SWAP' {
  if (field === 'mainComponent') return 'INSTANCE_SWAP'
  return field === 'characters' ? 'TEXT' : 'VISIBLE'
}

function propertyReferenceName(field: 'TEXT' | 'VISIBLE' | 'INSTANCE_SWAP'): string {
  if (field === 'INSTANCE_SWAP') return 'mainComponent'
  return field === 'TEXT' ? 'characters' : 'visible'
}
function applyProperty(
  target: ProxyThis,
  internals: NodeProxyInternals,
  node: SceneNode,
  definition: ComponentPropertyDefinition,
  value: string | boolean
): void {
  if (definition.type === 'VARIANT') {
    throw new Error('setProperties() cannot set VARIANT properties through the adapter')
  }
  const result = applyComponentPropertyValue(
    graph(target, internals),
    node.id,
    definition,
    String(value)
  )
  if (!result) throw new Error(`Unable to apply component property: ${propertyName(definition)}`)
}
export function installComponentPropertyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    componentPropertyDefinitions: {
      get(this: ProxyThis) {
        return definitions(this, internals)
      }
    },
    componentPropertyReferences: {
      get(this: ProxyThis) {
        const node = raw(this, internals)
        if (
          node.type !== 'INSTANCE' &&
          node.type !== 'COMPONENT' &&
          node.type !== 'FRAME' &&
          node.type !== 'TEXT'
        )
          return null
        return Object.fromEntries(
          node.componentPropertyReferences.map((reference) => [
            propertyReferenceName(reference.field),
            reference.propertyId
          ])
        )
      },
      set(this: ProxyThis, value: Record<string, string> | null) {
        if (value === null) {
          updateNode(this, internals, { componentPropertyReferences: [] })
          return
        }
        updateNode(this, internals, {
          componentPropertyReferences: Object.entries(value).map(([field, propertyId]) => ({
            propertyId,
            field: propertyReferenceField(field)
          }))
        })
      }
    },
    componentProperties: {
      get(this: ProxyThis) {
        return componentProperties(this, internals)
      }
    },
    isExposedInstance: {
      get(this: ProxyThis) {
        const node = raw(this, internals)
        return (
          node.type === 'INSTANCE' &&
          node.componentPropertyReferences.some((reference) => reference.field === 'INSTANCE_SWAP')
        )
      },
      set(this: ProxyThis, value: boolean) {
        const node = raw(this, internals)
        if (node.type !== 'INSTANCE')
          throw new Error('isExposedInstance is only supported on instances')
        if (!value)
          updateNode(this, internals, {
            componentPropertyReferences: node.componentPropertyReferences.filter(
              (reference) => reference.field !== 'INSTANCE_SWAP'
            )
          })
      }
    },
    exposedInstances: {
      get(this: ProxyThis) {
        const node = raw(this, internals)
        if (node.type !== 'INSTANCE') return []
        const result: FigmaNodeProxy[] = []
        const visit = (id: string): void => {
          const child = graph(this, internals).getNode(id)
          if (!child) return
          if (
            child.type === 'INSTANCE' &&
            child.componentPropertyReferences.some(
              (reference) => reference.field === 'INSTANCE_SWAP'
            )
          )
            result.push(
              (this[internals.api] as { wrapNode(id: string): FigmaNodeProxy }).wrapNode(child.id)
            )
          child.childIds.forEach(visit)
        }
        node.childIds.forEach(visit)
        return result
      }
    },
    setProperties: {
      value(this: ProxyThis, properties: Record<string, string | boolean>) {
        const node = raw(this, internals)
        if (node.type !== 'INSTANCE')
          throw new Error('setProperties() can only be called on instances')
        for (const [name, value] of Object.entries(properties)) {
          const definition = findDefinition(this, internals, name)
          if (!definition) throw new Error(`Unknown component property: ${name}`)
          applyProperty(this, internals, node, definition, value)
        }
      }
    },
    addComponentProperty: {
      value(
        this: ProxyThis,
        name: string,
        type: ComponentPropertyType,
        defaultValue: string | boolean,
        options?: { preferredValues?: InstanceSwapPreferredValue[] }
      ) {
        const node = raw(this, internals)
        if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')
          throw new Error('addComponentProperty() can only be called on components')
        const definition: ComponentPropertyDefinition = {
          id: `prop:${randomHex(8)}`,
          name: name.trim(),
          type,
          defaultValue:
            type === 'BOOLEAN'
              ? String(defaultValue === true || defaultValue === 'true')
              : String(defaultValue)
        }
        if (options?.preferredValues) {
          definition.preferredValues = options.preferredValues.map((value) => value.key)
        }
        updateNode(this, internals, {
          componentPropertyDefinitions: [...node.componentPropertyDefinitions, definition]
        })
        return propertyName(definition)
      }
    },
    editComponentProperty: {
      value(
        this: ProxyThis,
        name: string,
        changes: { name?: string; defaultValue?: string | boolean }
      ) {
        return editPropertyDefinitions(this, internals, name, changes)
      }
    },
    deleteComponentProperty: {
      value(this: ProxyThis, name: string) {
        const node = raw(this, internals)
        if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')
          throw new Error('deleteComponentProperty() can only be called on components')
        const definition = findDefinition(this, internals, name)
        if (!definition) throw new Error(`Unknown component property: ${name}`)
        removeComponentProperty(graph(this, internals), node.id, definition.id)
      }
    }
  })
}
export function combineComponentsAsVariants(
  graph: SceneGraph,
  nodeIds: ReadonlyArray<string>,
  parentId: string,
  index?: number
): SceneNode {
  const components = requireDistinctComponents(graph, nodeIds)
  const parent = graph.getNode(parentId)
  if (!parent) throw new Error('Parent node not found')

  const bounds = computeAbsoluteBounds(components, (id) => graph.getAbsolutePosition(id))
  const parentPosition =
    parentId === graph.rootId || parent.type === 'CANVAS'
      ? { x: 0, y: 0 }
      : graph.getAbsolutePosition(parentId)
  const componentSet = graph.createNode('COMPONENT_SET', parentId, {
    name: components[0].name.split('/')[0]?.trim() || 'Component Set',
    x: bounds.x - parentPosition.x - COMPONENT_SET_PADDING,
    y: bounds.y - parentPosition.y - COMPONENT_SET_PADDING,
    width: bounds.width + COMPONENT_SET_PADDING * 2,
    height: bounds.height + COMPONENT_SET_PADDING * 2,
    fills: [
      {
        type: 'SOLID',
        color: { r: 0.96, g: 0.96, b: 0.96, a: 1 },
        opacity: 1,
        visible: true
      }
    ]
  })

  for (const component of components) graph.reparentNode(component.id, componentSet.id)
  if (index !== undefined) graph.reorderChild(componentSet.id, parentId, index)

  const derived = deriveSlashVariantProperties(components, () => `prop:${randomHex(8)}`)
  if (derived) {
    for (const [nodeId, changes] of derived.variants) graph.updateNode(nodeId, changes)
    graph.updateNode(componentSet.id, { componentPropertyDefinitions: derived.definitions })
  }

  return componentSet
}
