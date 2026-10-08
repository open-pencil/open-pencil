import { uniq } from 'es-toolkit/array'

import type {
  ComponentPropertyReferenceField,
  ComponentPropertyDefinition,
  ComponentPropertyType,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'
import {
  applyComponentPropertyValue,
  componentPropertyDefinitions as sharedComponentPropertyDefinitions,
  removeComponentProperty,
  createComponentPropertyId,
  exposedInstances,
  instanceExposureIssue
} from '@open-pencil/scene-graph'
import { cloneNodeProps } from '@open-pencil/scene-graph/copy'

import { becomesComponent, componentWrapProps } from '#core/editor/components/create'
import { applyVariantProperties, variantSetProps } from '#core/editor/components/variant-set'
import { wrapNodes } from '#core/editor/structure/container-wrap'

import type { NodeProxyInternals, ProxyThis } from './accessor-utils'
import { graph, raw, updateNode } from './accessor-utils'
import type { FigmaNodeProxy } from './proxy'
import {
  assertSlotSettings,
  figmaSlotSettings,
  mergeSlotSettings,
  type FigmaSlotSettings
} from './slots'

type InstanceSwapPreferredValue = { type: 'COMPONENT' | 'COMPONENT_SET'; key: string }

interface FigmaComponentPropertyDefinition {
  type: ComponentPropertyType
  defaultValue: string | boolean
  preferredValues?: InstanceSwapPreferredValue[]
  variantOptions?: string[]
  description?: string
  slotSettings?: FigmaSlotSettings
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
  const candidateIds = uniq(candidateNodes.map((node) => node.id))
  if (candidateIds.length !== candidateNodes.length) throw new Error('Candidates must be distinct')
  const host = findPropertyHost(graph, slotNodes[0].parentId)
  if (!host) throw new Error('Instance must be nested inside a COMPONENT or COMPONENT_SET')
  if (host.componentPropertyDefinitions.some((definition) => definition.name === name))
    throw new Error(`A component property named "${name}" already exists`)
  if (!slotNodes.every((node) => findPropertyHost(graph, node.parentId)?.id === host.id))
    throw new Error('All instances must belong to the same component or component set')
  const definition: ComponentPropertyDefinition = {
    id: createComponentPropertyId(),
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
): Pick<
  FigmaComponentPropertyDefinition,
  'preferredValues' | 'variantOptions' | 'description' | 'slotSettings'
> {
  const metadata: Pick<
    FigmaComponentPropertyDefinition,
    'preferredValues' | 'variantOptions' | 'description' | 'slotSettings'
  > = {}
  if (definition.description) metadata.description = definition.description
  if (definition.slotSettings) metadata.slotSettings = figmaSlotSettings(definition.slotSettings)
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
    description?: string
    slotSettings?: FigmaSlotSettings
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
  if (changes.description !== undefined) updated.description = changes.description
  assertSlotSettings(definition.type, changes.slotSettings)
  if (changes.slotSettings)
    updated.slotSettings = mergeSlotSettings(definition.slotSettings, changes.slotSettings)
  updateNode(target, internals, {
    componentPropertyDefinitions: node.componentPropertyDefinitions.map((item) =>
      item.id === definition.id ? updated : item
    )
  })
  return propertyName(updated)
}
function propertyReferenceField(field: string): ComponentPropertyReferenceField {
  if (field === 'mainComponent') return 'INSTANCE_SWAP'
  if (field === 'slotContentId') return 'SLOT_CONTENT'
  return field === 'characters' ? 'TEXT' : 'VISIBLE'
}

/**
 * Definitions a layer's references can name: those of the component it is part of, or of the
 * instance's component when it is a layer of an instance.
 */
function referableDefinitions(g: SceneGraph, node: SceneNode): ComponentPropertyDefinition[] {
  let owner = node.parentId ? g.getNode(node.parentId) : undefined
  while (owner && owner.type !== 'CANVAS') {
    if (owner.type === 'INSTANCE') return sharedComponentPropertyDefinitions(g, owner)
    if (owner.type === 'COMPONENT') {
      const set = owner.parentId ? g.getNode(owner.parentId) : undefined
      return [
        ...owner.componentPropertyDefinitions,
        ...(set?.type === 'COMPONENT_SET' ? set.componentPropertyDefinitions : [])
      ]
    }
    owner = owner.parentId ? g.getNode(owner.parentId) : undefined
  }
  return []
}

/** Figma's names: `slotContentId` is what a slot frame reports for its slot property. */
function propertyReferenceName(field: ComponentPropertyReferenceField): string {
  if (field === 'INSTANCE_SWAP') return 'mainComponent'
  if (field === 'SLOT_CONTENT') return 'slotContentId'
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
        // References name properties by key, `Name#id`, as componentPropertyDefinitions does.
        const definitions = referableDefinitions(graph(this, internals), node)
        return Object.fromEntries(
          node.componentPropertyReferences.map((reference) => {
            const definition = definitions.find((item) => item.id === reference.propertyId)
            return [
              propertyReferenceName(reference.field),
              definition ? propertyName(definition) : reference.propertyId
            ]
          })
        )
      },
      set(this: ProxyThis, value: Record<string, string> | null) {
        if (value === null) {
          updateNode(this, internals, { componentPropertyReferences: [] })
          return
        }
        const definitions = referableDefinitions(graph(this, internals), raw(this, internals))
        updateNode(this, internals, {
          componentPropertyReferences: Object.entries(value).map(([field, key]) => ({
            propertyId:
              definitions.find((definition) => propertyName(definition) === key)?.id ?? key,
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
        if (node.type !== 'INSTANCE') return false
        if (node.isExposedInstance) return true
        // A copy inside an instance reports what its source in the component says.
        const owner = node.parentId
          ? graph(this, internals).closest(node.parentId, (item) => item.type === 'INSTANCE')
          : undefined
        return !!owner && exposedInstances(graph(this, internals), owner).includes(node)
      },
      set(this: ProxyThis, value: boolean) {
        const node = raw(this, internals)
        if (node.type !== 'INSTANCE')
          throw new Error('isExposedInstance is only supported on instances')
        const issue = instanceExposureIssue(graph(this, internals), node)
        if (issue === 'not-in-component')
          throw new Error(
            'Instance must be contained within a component or component set to be exposed.'
          )
        if (issue === 'not-primary') throw new Error('Can only expose primary instances.')
        if (value && issue)
          throw new Error(
            'Can only expose instances that have exposed nested instances or children with component property references.'
          )
        updateNode(this, internals, { isExposedInstance: value })
      }
    },
    exposedInstances: {
      get(this: ProxyThis) {
        const node = raw(this, internals)
        const api = this[internals.api] as { wrapNode(id: string): FigmaNodeProxy }
        return exposedInstances(graph(this, internals), node).map((item) => api.wrapNode(item.id))
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
        options?: {
          preferredValues?: InstanceSwapPreferredValue[]
          description?: string
          slotSettings?: FigmaSlotSettings
        }
      ) {
        const node = raw(this, internals)
        if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')
          throw new Error('addComponentProperty() can only be called on components')
        const definition: ComponentPropertyDefinition = {
          id: createComponentPropertyId(),
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
        if (options?.description !== undefined) definition.description = options.description
        assertSlotSettings(type, options?.slotSettings)
        if (type === 'SLOT') {
          definition.preferredValues ??= []
          definition.slotSettings = mergeSlotSettings(undefined, options?.slotSettings ?? {})
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
        changes: {
          name?: string
          defaultValue?: string | boolean
          preferredValues?: InstanceSwapPreferredValue[]
          description?: string
          slotSettings?: FigmaSlotSettings
        }
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

  // The plugin API wraps the variants exactly; see `variantSetProps`.
  const componentSet = wrapNodes(
    graph,
    'COMPONENT_SET',
    components,
    parentId,
    index,
    variantSetProps(graph, components, parentId, 'script')
  )
  applyVariantProperties(graph, components, componentSet.id)

  return componentSet
}

/**
 * Makes a component from a layer as Figma's `createComponentFromNode` does: a frame or group
 * becomes a new component with its look and children in its place in the stack, and any other
 * layer is wrapped; see `becomesComponent`. Unlike the canvas command, the component takes a new id.
 */
export function componentFromNode(graph: SceneGraph, node: SceneNode, parentId: string): SceneNode {
  const index = graph.getNode(parentId)?.childIds.indexOf(node.id) ?? -1
  if (!becomesComponent(node)) {
    return wrapNodes(
      graph,
      'COMPONENT',
      [node],
      parentId,
      index < 0 ? undefined : index,
      componentWrapProps([node])
    )
  }
  const component = graph.createNode('COMPONENT', parentId, {
    ...cloneNodeProps(node, null),
    type: 'COMPONENT'
  })
  for (const childId of node.childIds) graph.reparentNode(childId, component.id)
  if (index >= 0) graph.insertChildAt(component.id, parentId, index)
  graph.deleteNode(node.id)
  return component
}
