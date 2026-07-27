import type { SceneGraph } from '@open-pencil/scene-graph'

import { raw, type NodeProxyInternals, type ProxyThis } from '#core/figma-api/accessor-utils'

function graph(target: ProxyThis, internals: NodeProxyInternals): SceneGraph {
  return target[internals.graph] as SceneGraph
}

export function installVariableModeNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    explicitVariableModes: {
      get(this: ProxyThis): Readonly<Record<string, string>> {
        return Object.freeze({ ...raw(this, internals).variableModes })
      }
    },
    resolvedVariableModes: {
      get(this: ProxyThis): Readonly<Record<string, string>> {
        const sceneGraph = graph(this, internals)
        const node = raw(this, internals)
        const modes: Record<string, string> = {}
        for (const collectionId of sceneGraph.variableCollections.keys()) {
          const modeId = sceneGraph.getNodeVariableModeId(node.id, collectionId)
          if (modeId) modes[collectionId] = modeId
        }
        return Object.freeze(modes)
      }
    }
  })
}
