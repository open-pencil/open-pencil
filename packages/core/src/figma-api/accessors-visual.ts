import { normalizeColor } from '#core/color'
import { copyEffects, copyFills, copyStrokes } from '#core/scene-graph/copy'

import { raw, updateNode, type NodeProxyInternals, type ProxyThis } from './accessor-utils'

import type { Effect, Fill, SceneNode, Stroke } from '#core/scene-graph'

export function installVisualNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals,
  mixed: symbol
): void {
  Object.defineProperties(prototype, {
    fills: {
      get(this: ProxyThis): readonly Fill[] {
        return Object.freeze(copyFills(raw(this, internals).fills))
      },
      set(this: ProxyThis, value: readonly Fill[]) {
        updateNode(this, internals, {
          fills: value.map((fill) => ({
            ...fill,
            color: normalizeColor(fill.color),
            gradientStops: fill.gradientStops?.map((stop) => ({
              ...stop,
              color: normalizeColor(stop.color)
            }))
          }))
        })
      }
    },
    strokes: {
      get(this: ProxyThis): readonly Stroke[] {
        return Object.freeze(copyStrokes(raw(this, internals).strokes))
      },
      set(this: ProxyThis, value: readonly Stroke[]) {
        updateNode(this, internals, {
          strokes: value.map((stroke) => ({ ...stroke, color: normalizeColor(stroke.color) }))
        })
      }
    },
    effects: {
      get(this: ProxyThis): readonly Effect[] {
        return Object.freeze(copyEffects(raw(this, internals).effects))
      },
      set(this: ProxyThis, value: readonly Effect[]) {
        updateNode(this, internals, {
          effects: value.map((effect) => ({ ...effect, color: normalizeColor(effect.color) }))
        })
      }
    },
    opacity: {
      get(this: ProxyThis): number {
        return raw(this, internals).opacity
      },
      set(this: ProxyThis, value: number) {
        updateNode(this, internals, { opacity: value })
      }
    },
    visible: {
      get(this: ProxyThis): boolean {
        return raw(this, internals).visible
      },
      set(this: ProxyThis, value: boolean) {
        updateNode(this, internals, { visible: value })
      }
    },
    locked: {
      get(this: ProxyThis): boolean {
        return raw(this, internals).locked
      },
      set(this: ProxyThis, value: boolean) {
        updateNode(this, internals, { locked: value })
      }
    },
    blendMode: {
      get(this: ProxyThis): string {
        return raw(this, internals).blendMode
      },
      set(this: ProxyThis, value: string) {
        updateNode(this, internals, { blendMode: value as SceneNode['blendMode'] })
      }
    },
    clipsContent: {
      get(this: ProxyThis): boolean {
        return raw(this, internals).clipsContent
      },
      set(this: ProxyThis, value: boolean) {
        updateNode(this, internals, { clipsContent: value })
      }
    },
    cornerRadius: {
      get(this: ProxyThis): number | symbol {
        const node = raw(this, internals)
        if (node.independentCorners) return mixed
        return node.cornerRadius
      },
      set(this: ProxyThis, value: number | symbol) {
        if (value === mixed) return
        updateNode(this, internals, {
          cornerRadius: value as number,
          topLeftRadius: value as number,
          topRightRadius: value as number,
          bottomRightRadius: value as number,
          bottomLeftRadius: value as number,
          independentCorners: false
        })
      }
    },
    topLeftRadius: cornerAccessor(internals, 'topLeftRadius'),
    topRightRadius: cornerAccessor(internals, 'topRightRadius'),
    bottomLeftRadius: cornerAccessor(internals, 'bottomLeftRadius'),
    bottomRightRadius: cornerAccessor(internals, 'bottomRightRadius'),
    cornerSmoothing: {
      get(this: ProxyThis): number {
        return raw(this, internals).cornerSmoothing
      },
      set(this: ProxyThis, value: number) {
        updateNode(this, internals, { cornerSmoothing: value })
      }
    }
  })
}

function cornerAccessor(
  internals: NodeProxyInternals,
  field: 'topLeftRadius' | 'topRightRadius' | 'bottomLeftRadius' | 'bottomRightRadius'
): PropertyDescriptor {
  return {
    get(this: ProxyThis): number {
      return raw(this, internals)[field]
    },
    set(this: ProxyThis, value: number) {
      updateNode(this, internals, { [field]: value, independentCorners: true })
    }
  }
}
