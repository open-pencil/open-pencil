import type { SceneGraph } from '@open-pencil/scene-graph'

export interface RpcCommand<A = unknown, R = unknown> {
  name: string
  execute: (graph: SceneGraph, args: A) => R | Promise<R>
}
