import * as v from 'valibot'

import type { SceneNode } from '@open-pencil/scene-graph'
import { newStrokeGeometry } from '@open-pencil/scene-graph/node-defaults'

import {
  assertProxyEditable,
  nodeId,
  raw,
  strokeOwner,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessors/utils'
import { graphOf } from '#core/figma-api/graph'
import { finiteNumber, finiteNumberSchema } from '#core/figma-api/schema'
import {
  setDashPattern,
  setIndependentStrokeWeight,
  setStrokeAlign,
  setStrokeWeight
} from '#core/figma-api/strokes'
import { parseFigma } from '#core/figma-api/validation'

type IndependentWeightField =
  | 'borderTopWeight'
  | 'borderRightWeight'
  | 'borderBottomWeight'
  | 'borderLeftWeight'

const INDEPENDENT_WEIGHT_PROPERTIES = {
  borderTopWeight: 'strokeTopWeight',
  borderRightWeight: 'strokeRightWeight',
  borderBottomWeight: 'strokeBottomWeight',
  borderLeftWeight: 'strokeLeftWeight'
} as const satisfies Record<IndependentWeightField, string>

function independentWeight(internals: NodeProxyInternals, field: IndependentWeightField) {
  return {
    get(this: ProxyThis): number {
      return raw(this, internals)[field]
    },
    set(this: ProxyThis, value: unknown) {
      const weight = finiteNumber(value, INDEPENDENT_WEIGHT_PROPERTIES[field])
      assertProxyEditable(this, internals)
      setIndependentStrokeWeight(graphOf(this), nodeId(this, internals), field, weight)
    }
  }
}

export function installStrokeNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    // Figma keeps stroke weight and alignment on the node, with or without strokes.
    strokeWeight: {
      get(this: ProxyThis): number {
        return newStrokeGeometry(raw(strokeOwner(this, internals), internals)).weight
      },
      set(this: ProxyThis, value: unknown) {
        const weight = finiteNumber(value, 'strokeWeight')
        assertProxyEditable(strokeOwner(this, internals), internals)
        setStrokeWeight(graphOf(this), raw(strokeOwner(this, internals), internals), weight)
      }
    },
    strokeAlign: {
      get(this: ProxyThis): string {
        return newStrokeGeometry(raw(strokeOwner(this, internals), internals)).align
      },
      set(this: ProxyThis, value: SceneNode['strokeAlign']) {
        assertProxyEditable(strokeOwner(this, internals), internals)
        setStrokeAlign(graphOf(this), raw(strokeOwner(this, internals), internals), value)
      }
    },
    dashPattern: {
      get(this: ProxyThis): readonly number[] {
        return Object.freeze([...raw(strokeOwner(this, internals), internals).dashPattern])
      },
      set(this: ProxyThis, value: unknown) {
        const pattern = parseFigma(
          v.array(finiteNumberSchema),
          value,
          'set_dashPattern',
          'dashPattern'
        )
        assertProxyEditable(strokeOwner(this, internals), internals)
        setDashPattern(graphOf(this), raw(strokeOwner(this, internals), internals), pattern)
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
        return raw(strokeOwner(this, internals), internals).strokeJoin
      },
      set(this: ProxyThis, value: string) {
        const strokeJoin = value as SceneNode['strokeJoin']
        const owner = strokeOwner(this, internals)
        const node = raw(owner, internals)
        updateNode(owner, internals, {
          strokeJoin,
          strokes: node.strokes.map((stroke) => ({ ...stroke, join: strokeJoin }))
        })
      }
    },
    strokeMiterLimit: {
      get(this: ProxyThis): number {
        return raw(this, internals).strokeMiterLimit
      },
      set(this: ProxyThis, value: unknown) {
        updateNode(this, internals, { strokeMiterLimit: finiteNumber(value, 'strokeMiterLimit') })
      }
    },
    strokeTopWeight: independentWeight(internals, 'borderTopWeight'),
    strokeBottomWeight: independentWeight(internals, 'borderBottomWeight'),
    strokeLeftWeight: independentWeight(internals, 'borderLeftWeight'),
    strokeRightWeight: independentWeight(internals, 'borderRightWeight')
  })
}
