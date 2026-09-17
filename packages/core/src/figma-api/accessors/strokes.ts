import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import {
  nodeId,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import {
  setFirstStrokeAlign,
  setFirstStrokeWeight,
  setIndependentStrokeWeight
} from '#core/figma-api/strokes'

type IndependentWeightField =
  | 'borderTopWeight'
  | 'borderRightWeight'
  | 'borderBottomWeight'
  | 'borderLeftWeight'

function graph(target: ProxyThis, internals: NodeProxyInternals): SceneGraph {
  return target[internals.graph] as SceneGraph
}

function independentWeight(internals: NodeProxyInternals, field: IndependentWeightField) {
  return {
    get(this: ProxyThis): number {
      return raw(this, internals)[field]
    },
    set(this: ProxyThis, value: number) {
      setIndependentStrokeWeight(graph(this, internals), nodeId(this, internals), field, value)
    }
  }
}

export function installStrokeNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    strokeWeight: {
      get(this: ProxyThis): number {
        const strokes = raw(this, internals).strokes
        return strokes.length > 0 ? strokes[0].weight : 0
      },
      set(this: ProxyThis, value: number) {
        setFirstStrokeWeight(graph(this, internals), raw(this, internals), value)
      }
    },
    strokeAlign: {
      get(this: ProxyThis): string {
        const strokes = raw(this, internals).strokes
        return strokes.length > 0 ? strokes[0].align : 'INSIDE'
      },
      set(this: ProxyThis, value: string) {
        setFirstStrokeAlign(graph(this, internals), raw(this, internals), value)
      }
    },
    dashPattern: {
      get(this: ProxyThis): readonly number[] {
        return Object.freeze([...raw(this, internals).dashPattern])
      },
      set(this: ProxyThis, value: readonly number[]) {
        updateNode(this, internals, { dashPattern: [...value] })
      }
    },
    strokeCap: {
      get(this: ProxyThis): string {
        return raw(this, internals).strokeCap
      },
      set(this: ProxyThis, value: string) {
        const strokeCap = value as SceneNode['strokeCap']
        const node = raw(this, internals)
        updateNode(this, internals, {
          strokeCap,
          strokes: node.strokes.map((stroke) => ({ ...stroke, cap: strokeCap }))
        })
      }
    },
    strokeJoin: {
      get(this: ProxyThis): string {
        return raw(this, internals).strokeJoin
      },
      set(this: ProxyThis, value: string) {
        const strokeJoin = value as SceneNode['strokeJoin']
        const node = raw(this, internals)
        updateNode(this, internals, {
          strokeJoin,
          strokes: node.strokes.map((stroke) => ({ ...stroke, join: strokeJoin }))
        })
      }
    },
    strokeMiterLimit: {
      get(this: ProxyThis): number {
        return raw(this, internals).strokeMiterLimit
      },
      set(this: ProxyThis, value: number) {
        updateNode(this, internals, { strokeMiterLimit: value })
      }
    },
    strokeTopWeight: independentWeight(internals, 'borderTopWeight'),
    strokeBottomWeight: independentWeight(internals, 'borderBottomWeight'),
    strokeLeftWeight: independentWeight(internals, 'borderLeftWeight'),
    strokeRightWeight: independentWeight(internals, 'borderRightWeight')
  })
}
