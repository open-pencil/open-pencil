import {
  graph,
  nodeId,
  raw,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import type { NodeProxyHost } from '#core/figma-api/proxy'
import type { SceneNode } from '#core/scene-graph'
import type { Rect } from '#core/types'

export function installBasicNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    id: {
      get(this: ProxyThis): string {
        return nodeId(this, internals)
      }
    },
    type: {
      get(this: ProxyThis): SceneNode['type'] {
        return raw(this, internals).type
      }
    },
    name: {
      get(this: ProxyThis): string {
        return raw(this, internals).name
      },
      set(this: ProxyThis, value: string) {
        graph(this, internals).updateNode(nodeId(this, internals), { name: value })
      }
    },
    removed: {
      get(this: ProxyThis): boolean {
        return !graph(this, internals).getNode(nodeId(this, internals))
      }
    },
    x: {
      get(this: ProxyThis): number {
        return raw(this, internals).x
      },
      set(this: ProxyThis, value: number) {
        graph(this, internals).updateNode(nodeId(this, internals), { x: value })
      }
    },
    y: {
      get(this: ProxyThis): number {
        return raw(this, internals).y
      },
      set(this: ProxyThis, value: number) {
        graph(this, internals).updateNode(nodeId(this, internals), { y: value })
      }
    },
    width: {
      get(this: ProxyThis): number {
        return raw(this, internals).width
      }
    },
    height: {
      get(this: ProxyThis): number {
        return raw(this, internals).height
      }
    },
    rotation: {
      get(this: ProxyThis): number {
        return raw(this, internals).rotation
      },
      set(this: ProxyThis, value: number) {
        graph(this, internals).updateNode(nodeId(this, internals), { rotation: value })
      }
    },
    absoluteTransform: {
      get(this: ProxyThis): [[number, number, number], [number, number, number]] {
        const pos = graph(this, internals).getAbsolutePosition(nodeId(this, internals))
        return [
          [1, 0, pos.x],
          [0, 1, pos.y]
        ]
      }
    },
    absoluteBoundingBox: {
      get(this: ProxyThis): Rect {
        return graph(this, internals).getAbsoluteBounds(nodeId(this, internals))
      }
    },
    absoluteRenderBounds: {
      get(this: ProxyThis): Rect {
        return graph(this, internals).getAbsoluteBounds(nodeId(this, internals))
      }
    }
  })

  Object.assign(prototype, {
    resize(this: ProxyThis, width: number, height: number): void {
      graph(this, internals).updateNode(nodeId(this, internals), { width, height })
    },
    resizeWithoutConstraints(this: ProxyThis, width: number, height: number): void {
      ;(this as { resize(width: number, height: number): void }).resize(width, height)
    }
  })
}

export type { NodeProxyHost }
