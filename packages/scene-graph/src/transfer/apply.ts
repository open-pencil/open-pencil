import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph } from '../index'
import { variableIdentityReferences } from './identity'
import type { prepareGraphTransfer } from './plan'
import { validateTransferReferences } from './validation'
import { prepareVariableTransfer } from './variables'

export type GraphTransferPlan = ReturnType<typeof prepareGraphTransfer>

function validate(target: SceneGraph, plan: GraphTransferPlan): void {
  validateTransferReferences(target, plan)
  const reserved = new Set([
    ...target.nodes.keys(),
    ...target.variables.keys(),
    ...target.variableCollections.keys()
  ])
  const claim = (id: string): void => {
    if (reserved.has(id)) throw new Error(`Transfer identity collision ${id}`)
    reserved.add(id)
  }
  prepareVariableTransfer(
    plan.variables,
    plan.collections,
    variableIdentityReferences(plan.variables, plan.collections)
  )
  for (const [id, mode] of plan.activeModes) {
    if (
      !plan.collections
        .find((collection) => collection.id === id)
        ?.modes.some((entry) => entry.modeId === mode)
    )
      throw new Error(`Invalid transferred active mode ${id}:${mode}`)
  }
  for (const collection of plan.collections) claim(collection.id)
  for (const variable of plan.variables) claim(variable.id)
  const parents = new Set(target.nodes.keys())
  for (const node of plan.nodes) {
    claim(node.id)
    if ('id' in node.props || 'parentId' in node.props || 'childIds' in node.props)
      throw new Error('Transfer props cannot override hierarchy identity')
    if (!parents.has(node.parentId)) throw new Error(`Missing transfer parent ${node.parentId}`)
    parents.add(node.id)
  }
  for (const id of [...plan.rootIds, ...plan.dependencyPageIds]) {
    if (!plan.nodes.some((node) => node.id === id)) throw new Error(`Missing transfer root ${id}`)
  }
  for (const node of plan.nodes) {
    if (node.props.componentId && !parents.has(node.props.componentId))
      throw new Error(`Missing transfer component ${node.props.componentId}`)
  }
  for (const [hash, bytes] of plan.images) {
    const existing = target.images.get(hash)
    if (existing && !isEqual(existing, bytes)) throw new Error(`Transfer image collision ${hash}`)
  }
}

/** Revalidate at insertion time. Event-delivery failures after commit are not rollback failures. */
export function applyGraphTransfer(target: SceneGraph, input: GraphTransferPlan): void {
  const plan = structuredClone(input)
  validate(target, plan)
  const imageIds = [...plan.images.keys()].filter((hash) => !target.images.has(hash))
  target.withBufferedEvents(() => {
    try {
      for (const collection of plan.collections) target.addCollection(collection)
      for (const variable of plan.variables) target.addVariable(variable)
      for (const [id, mode] of plan.activeModes) target.activeMode.set(id, mode)
      for (const [hash, bytes] of plan.images)
        if (!target.images.has(hash)) target.images.set(hash, bytes)
      for (const node of plan.nodes)
        target.createNodeWithId(node.id, node.type, node.parentId, { ...node.props, childIds: [] })
    } catch (error) {
      for (const node of plan.nodes.toReversed())
        if (target.getNode(node.id)) target.deleteNode(node.id)
      for (const variable of plan.variables) target.variables.delete(variable.id)
      for (const collection of plan.collections) {
        target.variableCollections.delete(collection.id)
        target.activeMode.delete(collection.id)
      }
      for (const hash of imageIds) target.images.delete(hash)
      throw error
    }
  })
}
