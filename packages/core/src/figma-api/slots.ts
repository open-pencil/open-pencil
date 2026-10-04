import {
  DEFAULT_SLOT_SETTINGS,
  componentPropertyDefinitions,
  createSlotProperty,
  resetSlotContent,
  slotLimitViolations,
  slotPropertyId,
  slotScope,
  type ComponentPropertyType,
  type SlotLimitViolation,
  type SlotSettings
} from '@open-pencil/scene-graph'

import { randomHex } from '#core/random'

import type { NodeProxyInternals, ProxyThis } from './accessor-utils'
import { assertProxyEditable, graph, nodeId, raw } from './accessor-utils'
import type { NodeProxyHost } from './proxy'

/** Figma's slot limits, where an unset count reads as null. */
export interface FigmaSlotSettings {
  stretchChildOnInsert?: boolean
  displayEmptyByDefault?: boolean
  minChildren?: number | null
  maxChildren?: number | null
  allowPreferredValuesOnly?: boolean
}

/** A count after a Figma change: null clears it, undefined keeps the current one. */
function count(change: number | null | undefined, current: number | undefined) {
  return change === null ? undefined : (change ?? current)
}

/** Apply Figma slot settings to a definition's own. */
export function mergeSlotSettings(
  current: SlotSettings | undefined,
  changes: FigmaSlotSettings
): SlotSettings {
  const base = { ...DEFAULT_SLOT_SETTINGS, ...current }
  const next: SlotSettings = {
    stretchChildOnInsert: changes.stretchChildOnInsert ?? base.stretchChildOnInsert,
    displayEmptyByDefault: changes.displayEmptyByDefault ?? base.displayEmptyByDefault,
    allowPreferredValuesOnly: changes.allowPreferredValuesOnly ?? base.allowPreferredValuesOnly
  }
  const minChildren = count(changes.minChildren, base.minChildren)
  const maxChildren = count(changes.maxChildren, base.maxChildren)
  if (minChildren !== undefined) next.minChildren = minChildren
  if (maxChildren !== undefined) next.maxChildren = maxChildren
  return next
}

export function figmaSlotSettings(settings: SlotSettings): FigmaSlotSettings {
  return {
    ...settings,
    minChildren: settings.minChildren ?? null,
    maxChildren: settings.maxChildren ?? null
  }
}

export function assertSlotSettings(
  type: ComponentPropertyType,
  settings: FigmaSlotSettings | undefined
): void {
  if (settings && type !== 'SLOT')
    throw new Error("slotSettings is only supported for 'SLOT' properties")
}

function host(target: ProxyThis, internals: NodeProxyInternals): NodeProxyHost {
  return target[internals.api] as NodeProxyHost
}

/** The instance slot a proxy is, if it is the frame of one. */
function instanceSlot(target: ProxyThis, internals: NodeProxyInternals) {
  const scope = slotScope(graph(target, internals), nodeId(target, internals))
  return scope.kind === 'slot' && scope.frame.id === nodeId(target, internals) ? scope : undefined
}

/** `ComponentNode.createSlot` and the `SlotNode` members Figma's plugin API defines. */
export function installSlotAccessors(prototype: object, internals: NodeProxyInternals): void {
  Object.defineProperties(prototype, {
    createSlot: {
      // Figma appends a 100×100 frame named Slot, Slot 2, … and a SLOT property of that name.
      value(this: ProxyThis) {
        const component = raw(this, internals)
        if (component.type !== 'COMPONENT')
          throw new Error('createSlot() can only be called on components')
        assertProxyEditable(this, internals)
        const g = graph(this, internals)
        const frame = g.createNode('FRAME', component.id, { name: 'Slot' })
        const definition = createSlotProperty(g, frame.id, `prop:${randomHex(8)}`)
        if (!definition) throw new Error('Failed to create slot')
        g.updateNode(frame.id, { name: definition.name })
        return host(this, internals).wrapNode(frame.id)
      }
    },
    resetSlot: {
      value(this: ProxyThis) {
        if (!slotPropertyId(raw(this, internals)))
          throw new Error('resetSlot() can only be called on slots')
        assertProxyEditable(this, internals)
        const scope = instanceSlot(this, internals)
        if (scope) resetSlotContent(graph(this, internals), scope)
      }
    },
    limitViolations: {
      // Figma measures limits only where an instance shows the slot; a main component's slot
      // reports none.
      get(this: ProxyThis): SlotLimitViolation[] {
        const scope = instanceSlot(this, internals)
        if (!scope) return []
        const g = graph(this, internals)
        const definition = componentPropertyDefinitions(g, scope.instance).find(
          (item) => item.id === scope.propertyId
        )
        if (!definition) return []
        return slotLimitViolations(g, definition, g.getChildren(scope.frame.id))
      }
    }
  })
}
