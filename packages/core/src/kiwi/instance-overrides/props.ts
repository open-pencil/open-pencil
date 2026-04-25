import { guidToString } from '../convert'
import { resolveOverrideTarget, repopulateInstance } from './resolve'

import type {
  OverrideContext,
  ComponentPropAssignment,
  ComponentPropRef,
  ComponentPropValue
} from './types'

function normalizePropName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isEmptyPropValue(v: ComponentPropValue): boolean {
  return v.boolValue === undefined && v.textValue === undefined && v.guidValue === undefined
}

/**
 * Walk the componentId chain to find componentPropRefs for a node.
 * The refs may be defined on the component several levels up.
 */
function findPropRefs(
  ctx: OverrideContext,
  nodeId: string,
  propRefsMap: Map<string, ComponentPropRef[]>
): ComponentPropRef[] | undefined {
  let sourceId: string | undefined = nodeId
  for (let depth = 0; sourceId && depth < 10; depth++) {
    const figmaId = ctx.nodeIdToGuid.get(sourceId)
    if (figmaId) {
      const refs = propRefsMap.get(figmaId)
      if (refs) return refs
    }
    const node = ctx.graph.getNode(sourceId)
    const nextId = node?.componentId ?? undefined
    if (nextId === sourceId) break
    sourceId = nextId
  }
  return undefined
}

/**
 * Convert assignments to a defID → value map, optionally resolving empty
 * values to component defaults.
 *
 * In symbolOverride context, an empty kiwi value `{}` (all fields absent)
 * means "reset to the component's initialValue default". This is distinct
 * from `{boolValue: false}` which is an explicit false.
 */
function assignmentsToValueMap(
  ctx: OverrideContext,
  assignments: ComponentPropAssignment[],
  resolveDefaults = false
): Map<string, ComponentPropValue> {
  const valueByDef = new Map<string, ComponentPropValue>()
  for (const a of assignments) {
    if (!a.defID) continue
    const key = guidToString(a.defID)
    if (resolveDefaults && isEmptyPropValue(a.value)) {
      const def = ctx.propDefaults.get(key)
      if (def) {
        valueByDef.set(key, def)
        continue
      }
    }
    valueByDef.set(key, a.value)
  }
  return valueByDef
}

/**
 * Recursively apply prop assignments to children of a parent node.
 * Handles VISIBLE toggles and OVERRIDDEN_SYMBOL_ID (instance swap).
 */
function fallbackRefsForChild(
  ctx: OverrideContext,
  childName: string,
  valueByDef: Map<string, ComponentPropValue>
): ComponentPropRef[] | undefined {
  const normalizedChildName = normalizePropName(childName)
  const refs: ComponentPropRef[] = []
  for (const defId of valueByDef.keys()) {
    const propName = ctx.propNames.get(defId)
    if (propName && normalizePropName(propName) === normalizedChildName) {
      refs.push({
        defID: { sessionID: Number(defId.split(':')[0]), localID: Number(defId.split(':')[1]) },
        componentPropNodeField: 'VISIBLE'
      })
    }
  }
  return refs.length > 0 ? refs : undefined
}

function applyPropAssignments(
  ctx: OverrideContext,
  parentId: string,
  valueByDef: Map<string, ComponentPropValue>,
  propRefsMap: Map<string, ComponentPropRef[]>,
  modified?: Set<string>
): void {
  const parent = ctx.graph.getNode(parentId)
  if (!parent) return

  for (const childId of parent.childIds) {
    const child = ctx.graph.getNode(childId)
    if (!child?.componentId) {
      applyPropAssignments(ctx, childId, valueByDef, propRefsMap, modified)
      continue
    }

    const refs =
      findPropRefs(ctx, child.componentId, propRefsMap) ??
      fallbackRefsForChild(ctx, child.name, valueByDef)
    if (refs) {
      for (const ref of refs) {
        if (!ref.defID) continue
        const val = valueByDef.get(guidToString(ref.defID))
        if (!val) continue

        if (ref.componentPropNodeField === 'VISIBLE' && val.boolValue !== undefined) {
          ctx.graph.updateNode(childId, { visible: val.boolValue })
          modified?.add(childId)
        } else if (ref.componentPropNodeField === 'OVERRIDDEN_SYMBOL_ID') {
          const swapId = val.textValue ?? (val.guidValue ? guidToString(val.guidValue) : undefined)
          if (!swapId) continue
          const newCompId = ctx.guidToNodeId.get(swapId)
          if (newCompId) {
            repopulateInstance(ctx, childId, newCompId)
            modified?.add(childId)
          }
        }
      }
    }

    applyPropAssignments(ctx, childId, valueByDef, propRefsMap, modified)
  }
}

/**
 * Apply component property assignments from each instance's own kiwi data.
 *
 * Only processes nodes with their own kiwi NC — cloned instances inherit
 * correct values from their source via transitive sync.
 */
function applyInstanceDirectAssignments(
  ctx: OverrideContext,
  assignmentSources: Map<string, ComponentPropAssignment[]>,
  propRefsMap: Map<string, ComponentPropRef[]>,
  modified: Set<string>
): void {
  for (const node of ctx.graph.getAllNodes()) {
    if (ctx.activeNodeIds && !ctx.activeNodeIds.has(node.id)) continue
    if (node.type !== 'INSTANCE') continue
    const ownFigmaId = ctx.nodeIdToGuid.get(node.id)
    if (!ownFigmaId) continue
    const ownAssignments = assignmentSources.get(ownFigmaId)
    if (ownAssignments) {
      applyPropAssignments(
        ctx,
        node.id,
        assignmentsToValueMap(ctx, ownAssignments),
        propRefsMap,
        modified
      )
    }
  }
}

/**
 * Apply component property assignments from symbolOverrides.
 *
 * These target nested instances via guidPath and may reset values to
 * component defaults (empty kiwi value `{}`).
 */
function applyOverrideAssignments(
  ctx: OverrideContext,
  propRefsMap: Map<string, ComponentPropRef[]>,
  modified: Set<string>
): void {
  for (const [figmaId, nc] of ctx.changeMap) {
    const instanceNodeId = ctx.guidToNodeId.get(figmaId)
    if (!instanceNodeId || (ctx.activeNodeIds && !ctx.activeNodeIds.has(instanceNodeId))) continue
    if (ctx.graph.getNode(instanceNodeId)?.type !== 'INSTANCE') continue

    const overrides = nc.symbolData?.symbolOverrides
    if (!overrides) continue
    for (const ov of overrides) {
      if (!ov.componentPropAssignments?.length) continue

      const guids = ov.guidPath?.guids
      if (!guids?.length) continue

      const targetId = resolveOverrideTarget(ctx, instanceNodeId, guids)
      if (!targetId) continue

      applyPropAssignments(
        ctx,
        targetId,
        assignmentsToValueMap(ctx, ov.componentPropAssignments, true),
        propRefsMap,
        modified
      )
    }
  }
}

/**
 * Apply all component property assignments (visibility toggles, instance swaps).
 *
 * Returns the set of modified node IDs so the caller can run a second
 * transitive sync to propagate the changes to deeper clones.
 */
export function applyComponentProperties(ctx: OverrideContext): Set<string> {
  const modified = new Set<string>()

  const propRefsMap = new Map<string, ComponentPropRef[]>()
  for (const [figmaId, nc] of ctx.changeMap) {
    if (nc.componentPropRefs?.length) {
      propRefsMap.set(figmaId, nc.componentPropRefs)
    }
  }
  if (propRefsMap.size === 0) return modified

  const assignmentSources = new Map<string, ComponentPropAssignment[]>()
  for (const [figmaId, nc] of ctx.changeMap) {
    if (nc.componentPropAssignments?.length) {
      assignmentSources.set(figmaId, nc.componentPropAssignments)
    }
  }

  applyInstanceDirectAssignments(ctx, assignmentSources, propRefsMap, modified)
  applyOverrideAssignments(ctx, propRefsMap, modified)

  return modified
}
