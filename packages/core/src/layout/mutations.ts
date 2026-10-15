import { uniq } from 'es-toolkit'

import {
  collectSceneMutation,
  connectorsAffectedBy,
  layoutConnector,
  mutationLayoutScopeIds,
  type SceneGraph,
  type SceneNode,
  type SceneMutationImpact
} from '@open-pencil/scene-graph'

import { computeAllLayouts, computeLayout } from '#core/layout'

export function createLayoutRunner(getGraph: () => SceneGraph) {
  function runLayoutForNode(id: string) {
    const graph = getGraph()
    const node = graph.getNode(id)
    if (!node) return

    computeAllLayouts(graph, id)

    let parent = node.parentId ? graph.getNode(node.parentId) : undefined
    while (parent) {
      if (parent.layoutMode !== 'NONE') {
        computeLayout(graph, parent.id)
      }
      parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
    }
  }

  function compactLayoutScope(impact: SceneMutationImpact): string[] {
    const graph = getGraph()
    const candidates = new Set(mutationLayoutScopeIds(impact).filter((id) => graph.getNode(id)))
    return [...candidates].filter((id) => {
      let parentId = graph.getNode(id)?.parentId ?? null
      while (parentId) {
        if (candidates.has(parentId)) return false
        parentId = graph.getNode(parentId)?.parentId ?? null
      }
      return true
    })
  }

  async function runMutationWithLayout<T>(
    operation: () => T | Promise<T>,
    fallbackId?: string,
    beforeLayout?: (result: T) => Promise<void> | void
  ): Promise<T> {
    const graph = getGraph()
    const { result, impact } = await collectSceneMutation(graph, operation)
    await beforeLayout?.(result)
    if (!runLayoutForImpact(impact) && fallbackId) computeAllLayouts(graph, fallbackId)
    return result
  }

  /**
   * Lays out what an edit touched, and routes again the connectors it moved; returns whether
   * there was anything to lay out.
   */
  function runLayoutForImpact(impact: SceneMutationImpact): boolean {
    const scopeIds = compactLayoutScope(impact)
    for (const id of scopeIds) runLayoutForNode(id)
    routeConnectors(impact)
    return scopeIds.length > 0
  }

  /**
   * Routes the connectors an edit moved. One created together with the layers it joins, as a
   * paste makes it, keeps the route it came with; one that joins layers already there routes to
   * them.
   */
  function routeConnectors(impact: SceneMutationImpact) {
    const graph = getGraph()
    const created = impact.createdNodeIds
    const joinsExisting = (connector: SceneNode) =>
      [connector.connectorStart?.nodeId, connector.connectorEnd?.nodeId].some(
        (id) => id && !created.has(id) && graph.getNode(id)
      )
    const connectors = [
      ...connectorsAffectedBy(graph, impact.changedNodeIds),
      ...[...created].flatMap((id) => {
        const node = graph.getNode(id)
        return node?.type === 'CONNECTOR' && joinsExisting(node) ? [node] : []
      })
    ]
    graph.withLayoutMutations(() => {
      for (const connector of uniq(connectors)) layoutConnector(graph, connector)
    })
  }

  return { runLayoutForNode, runLayoutForImpact, runMutationWithLayout }
}
