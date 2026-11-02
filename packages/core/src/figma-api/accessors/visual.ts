import type { SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { newStrokeGeometry } from '@open-pencil/scene-graph/node-defaults'
import { independentCornerChanges, resolvedPaintBindings } from '@open-pencil/scene-graph/variables'
import { regionFillsDiffer } from '@open-pencil/scene-graph/vector-network'

import {
  graph,
  raw,
  strokeOwner,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { parseFigmaEffects, toFigmaEffect, type FigmaEffect } from '#core/figma-api/effects'
import { parseFigmaPaints, toFigmaPaint, type FigmaPaint } from '#core/figma-api/paints'
import { getTextStyle } from '#core/figma-api/text/style'
import { paintBindings, setPaintBindings } from '#core/figma-api/variables/bindings'
import { textStyleChanges } from '#core/text/character-style'

/**
 * `node`'s fills as Figma's plugin API reads them, bound colours resolved and carrying the
 * variable they are bound to.
 */
export function figmaFills(sceneGraph: SceneGraph, node: SceneNode): FigmaPaint[] {
  const bound = paintBindings(node, 'fills')
  const fills = bound.size
    ? (resolvedPaintBindings(sceneGraph, node).fills ?? node.fills)
    : node.fills
  return fills.map((fill, index) => toFigmaPaint(fill, bound.get(index)))
}

/** `node`'s strokes as Figma's plugin API reads them, as {@link figmaFills} reads fills. */
export function figmaStrokes(sceneGraph: SceneGraph, node: SceneNode): FigmaPaint[] {
  const bound = paintBindings(node, 'strokes')
  const strokes = bound.size
    ? (resolvedPaintBindings(sceneGraph, node).strokes ?? node.strokes)
    : node.strokes
  return strokes.map((stroke, index) => toFigmaPaint(stroke, bound.get(index)))
}

function setFills(
  target: ProxyThis,
  internals: NodeProxyInternals,
  value: readonly FigmaPaint[],
  method: string
): void {
  const node = raw(target, internals)
  const fills = parseFigmaPaints(value, method)
  updateNode(
    target,
    internals,
    node.type === 'TEXT' ? textStyleChanges(node, { fills }) : { fills }
  )
  setPaintBindings(graph(target, internals), raw(target, internals), 'fills', value)
}

/** Figma paints carry no geometry; a stroke takes the weight and alignment the node keeps. */
function setStrokes(
  target: ProxyThis,
  internals: NodeProxyInternals,
  value: readonly FigmaPaint[],
  method: string
): void {
  const owner = strokeOwner(target, internals)
  const geometry = newStrokeGeometry(raw(owner, internals))
  const strokes = parseFigmaPaints(value, method, 'strokes').map((paint): Stroke => ({
    ...paint,
    weight: geometry.weight,
    align: geometry.align
  }))
  const kept = newStrokeGeometry({
    strokes,
    strokeWeight: geometry.weight,
    strokeAlign: geometry.align
  })
  updateNode(owner, internals, { strokes, strokeWeight: kept.weight, strokeAlign: kept.align })
  setPaintBindings(graph(target, internals), raw(owner, internals), 'strokes', value)
}

export function installVisualNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals,
  mixed: symbol
): void {
  Object.defineProperties(prototype, {
    fills: {
      // Text reads mixed while its characters are filled differently, and a vector while its
      // regions are; setting it fills them all.
      get(this: ProxyThis): readonly FigmaPaint[] | symbol {
        const node = raw(this, internals)
        const sceneGraph = graph(this, internals)
        if (node.type === 'VECTOR') {
          // A region without paints of its own draws the layer's, its bound colors resolved.
          const layer = resolvedPaintBindings(sceneGraph, node).fills ?? node.fills
          if (regionFillsDiffer(node.vectorNetwork, layer)) return mixed
        }
        if (node.type !== 'TEXT') return Object.freeze(figmaFills(sceneGraph, node))
        const fills = getTextStyle(node, 'fills', mixed)
        // Text styles read for scripts already give Figma's paints.
        return typeof fills === 'symbol' ? fills : Object.freeze(fills as FigmaPaint[])
      },
      set(this: ProxyThis, value: readonly FigmaPaint[]) {
        setFills(this, internals, value, 'set_fills')
      }
    },
    strokes: {
      get(this: ProxyThis): readonly FigmaPaint[] {
        const owner = raw(strokeOwner(this, internals), internals)
        return Object.freeze(figmaStrokes(graph(this, internals), owner))
      },
      set(this: ProxyThis, value: readonly FigmaPaint[]) {
        setStrokes(this, internals, value, 'set_strokes')
      }
    },
    // Figma loads a pattern's source first; every node here is loaded, so these check and set as
    // `fills` and `strokes` do, throwing before they return.
    setFillsAsync: {
      value(this: ProxyThis, value: readonly FigmaPaint[]): Promise<void> {
        setFills(this, internals, value, 'setFillsAsync')
        return Promise.resolve()
      }
    },
    setStrokesAsync: {
      value(this: ProxyThis, value: readonly FigmaPaint[]): Promise<void> {
        setStrokes(this, internals, value, 'setStrokesAsync')
        return Promise.resolve()
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
        if (!node.independentCorners) return node.cornerRadius
        // Corners set or bound one by one read as one radius while they agree, as in Figma.
        const { topLeftRadius, topRightRadius, bottomLeftRadius, bottomRightRadius } = node
        const agree = [topRightRadius, bottomLeftRadius, bottomRightRadius].every(
          (radius) => radius === topLeftRadius
        )
        return agree ? topLeftRadius : mixed
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
      updateNode(this, internals, {
        ...independentCornerChanges(raw(this, internals)),
        [field]: value
      })
    }
  }
}
