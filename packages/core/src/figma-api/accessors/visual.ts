import type { Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { normalizeColor } from '@open-pencil/scene-graph/color'
import { copyFills, copyStrokes } from '@open-pencil/scene-graph/copy'

import { DEFAULT_STROKE_WEIGHT } from '#core/constants'
import {
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { parseFigmaEffects, toFigmaEffect, type FigmaEffect } from '#core/figma-api/effects'

function styleReference(
  internals: NodeProxyInternals,
  field: 'fillStyleId' | 'strokeStyleId' | 'effectStyleId' | 'gridStyleId'
): PropertyDescriptor {
  return {
    get(this: ProxyThis): string {
      return raw(this, internals)[field] ?? ''
    },
    set(this: ProxyThis, value: string) {
      updateNode(this, internals, { [field]: value || null })
    }
  }
}

/** Figma treats a paint's `opacity` and `visible` as optional, defaulting to 1 and `true`. */
function paintDefaults(paint: Partial<Pick<Fill, 'opacity' | 'visible'>>) {
  return { opacity: paint.opacity ?? 1, visible: paint.visible ?? true }
}

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
            ...paintDefaults(fill),
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
      // Figma paints carry no weight; a stroke takes the node's weight, 1 until one is set.
      set(this: ProxyThis, value: readonly (Omit<Stroke, 'weight'> & { weight?: number })[]) {
        const weight = raw(this, internals).strokes[0]?.weight ?? DEFAULT_STROKE_WEIGHT
        updateNode(this, internals, {
          strokes: value.map((stroke) => ({
            ...stroke,
            ...paintDefaults(stroke),
            weight: stroke.weight ?? weight,
            color: normalizeColor(stroke.color)
          }))
        })
      }
    },
    effects: {
      get(this: ProxyThis): readonly FigmaEffect[] {
        return Object.freeze(raw(this, internals).effects.map(toFigmaEffect))
      },
      set(this: ProxyThis, value: readonly FigmaEffect[]) {
        updateNode(this, internals, { effects: parseFigmaEffects(value) })
      }
    },
    // Applied shared styles, as Figma exposes them; an assignment inside an instance is an override.
    fillStyleId: styleReference(internals, 'fillStyleId'),
    strokeStyleId: styleReference(internals, 'strokeStyleId'),
    effectStyleId: styleReference(internals, 'effectStyleId'),
    gridStyleId: styleReference(internals, 'gridStyleId'),
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
