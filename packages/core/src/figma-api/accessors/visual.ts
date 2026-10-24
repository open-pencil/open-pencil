import type { Fill, GradientStop, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { normalizeColor } from '@open-pencil/scene-graph/color'
import { copyFills, copyStrokes } from '@open-pencil/scene-graph/copy'
import { newStrokeGeometry } from '@open-pencil/scene-graph/node-defaults'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { resolvedPaintBindings } from '@open-pencil/scene-graph/variables'

import {
  graph,
  raw,
  strokeOwner,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { parseFigmaEffects, toFigmaEffect, type FigmaEffect } from '#core/figma-api/effects'
import { sceneTransforms, toFigmaPaint, type WithFigmaTransforms } from '#core/figma-api/paints'
import { getTextStyle } from '#core/figma-api/text/style'
import {
  paintBindings,
  setPaintBindings,
  withPaintBinding
} from '#core/figma-api/variables/bindings'
import type { FigmaVariableAlias } from '#core/figma-api/variables/values'
import { textStyleChanges } from '#core/text/character-style'

function styleReference(
  internals: NodeProxyInternals,
  field: 'fillStyleId' | 'strokeStyleId' | 'effectStyleId' | 'gridStyleId',
  mixed: symbol
): PropertyDescriptor {
  return {
    get(this: ProxyThis): string | symbol {
      const node = raw(this, internals)
      // Characters of a text can each use a fill style of their own.
      if (field === 'fillStyleId' && node.type === 'TEXT') {
        return getTextStyle(node, 'fillStyleId', mixed) as string | symbol
      }
      return node[field] ?? ''
    },
    set(this: ProxyThis, value: string) {
      const node = raw(this, internals)
      const changes = { [field]: value || null }
      updateNode(
        this,
        internals,
        field === 'fillStyleId' && node.type === 'TEXT' ? textStyleChanges(node, changes) : changes
      )
    }
  }
}

/** Figma treats a paint's `opacity` and `visible` as optional, defaulting to 1 and `true`. */
function paintDefaults(paint: Partial<Pick<Fill, 'opacity' | 'visible'>>) {
  return { opacity: paint.opacity ?? 1, visible: paint.visible ?? true }
}

/** A colour as Figma's plugin API takes it, RGB with an optional alpha. */
type FigmaColor = Omit<Color, 'a'> & Partial<Pick<Color, 'a'>>

/**
 * A paint as Figma's plugin API takes it: RGB colours, optional opacity and visibility, transforms
 * as two rows of three, and the variable its colour is bound to.
 */
export type FigmaPaint = WithFigmaTransforms<
  Omit<Fill, 'color' | 'opacity' | 'visible' | 'gradientStops'>
> &
  Partial<Pick<Fill, 'opacity' | 'visible'>> & {
    color?: FigmaColor
    gradientStops?: Array<Omit<GradientStop, 'color'> & { color: FigmaColor }>
    boundVariables?: { color?: FigmaVariableAlias }
  }

/** The scene paint for a Figma paint at `index` in the list a script passes to `method`. */
export function figmaPaintToFill(
  paint: FigmaPaint,
  index = 0,
  method = 'set_fills',
  property = 'fills'
): Fill {
  const { boundVariables: _bound, gradientTransform: _g, imageTransform: _i, ...fill } = paint
  return {
    ...fill,
    ...paintDefaults(fill),
    ...sceneTransforms(paint, index, method, property),
    color: normalizeColor(fill.color),
    gradientStops: fill.gradientStops?.map((stop) => ({
      ...stop,
      color: normalizeColor(stop.color)
    }))
  }
}

/**
 * Copies of `node`'s fills as Figma's plugin API reads them: bound colours resolved and named,
 * transforms as two rows of three.
 */
export function figmaFills(sceneGraph: SceneGraph, node: SceneNode): WithFigmaTransforms<Fill>[] {
  const bound = paintBindings(node, 'fills')
  const fills = bound.size
    ? (resolvedPaintBindings(sceneGraph, node).fills ?? node.fills)
    : node.fills
  return copyFills(fills).map((fill, index) =>
    toFigmaPaint(withPaintBinding(fill, bound.get(index)))
  )
}

/** Copies of `node`'s strokes as Figma's plugin API reads them, as {@link figmaFills} reads fills. */
export function figmaStrokes(
  sceneGraph: SceneGraph,
  node: SceneNode
): WithFigmaTransforms<Stroke>[] {
  const bound = paintBindings(node, 'strokes')
  const strokes = bound.size
    ? (resolvedPaintBindings(sceneGraph, node).strokes ?? node.strokes)
    : node.strokes
  return copyStrokes(strokes).map((stroke, index) =>
    toFigmaPaint(withPaintBinding(stroke, bound.get(index)))
  )
}

export function installVisualNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals,
  mixed: symbol
): void {
  Object.defineProperties(prototype, {
    fills: {
      // Text reads mixed while its characters are filled differently, and setting it fills them all.
      get(this: ProxyThis): readonly WithFigmaTransforms<Fill>[] | symbol {
        const node = raw(this, internals)
        if (node.type !== 'TEXT') return Object.freeze(figmaFills(graph(this, internals), node))
        const fills = getTextStyle(node, 'fills', mixed)
        // Text styles read for scripts already give Figma's paints.
        return typeof fills === 'symbol'
          ? fills
          : Object.freeze(fills as WithFigmaTransforms<Fill>[])
      },
      set(this: ProxyThis, value: readonly FigmaPaint[]) {
        const node = raw(this, internals)
        const fills = value.map((paint, index) => figmaPaintToFill(paint, index))
        updateNode(
          this,
          internals,
          node.type === 'TEXT' ? textStyleChanges(node, { fills }) : { fills }
        )
        setPaintBindings(graph(this, internals), raw(this, internals), 'fills', value)
      }
    },
    strokes: {
      get(this: ProxyThis): readonly WithFigmaTransforms<Stroke>[] {
        const owner = raw(strokeOwner(this, internals), internals)
        return Object.freeze(figmaStrokes(graph(this, internals), owner))
      },
      // Figma paints carry no geometry; a stroke takes the node's weight and alignment, which
      // outlast its strokes.
      set(
        this: ProxyThis,
        value: readonly (WithFigmaTransforms<Omit<Stroke, 'weight' | 'align'>> &
          Partial<Pick<Stroke, 'weight' | 'align'>> & {
            boundVariables?: { color?: FigmaVariableAlias }
          })[]
      ) {
        const owner = strokeOwner(this, internals)
        const geometry = newStrokeGeometry(raw(owner, internals))
        // The script keeps its paint objects; the node gets its own copies of every nested value.
        const strokes = copyStrokes(
          value.map((paint, index) => {
            const {
              boundVariables: _bound,
              gradientTransform: _g,
              imageTransform: _i,
              ...stroke
            } = paint
            return {
              ...stroke,
              ...paintDefaults(stroke),
              ...sceneTransforms(paint, index, 'set_strokes', 'strokes'),
              weight: stroke.weight ?? geometry.weight,
              align: stroke.align ?? geometry.align,
              color: normalizeColor(stroke.color)
            }
          })
        )
        const kept = newStrokeGeometry({
          strokes,
          strokeWeight: geometry.weight,
          strokeAlign: geometry.align
        })
        updateNode(owner, internals, {
          strokes,
          strokeWeight: kept.weight,
          strokeAlign: kept.align
        })
        setPaintBindings(graph(this, internals), raw(owner, internals), 'strokes', value)
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
    fillStyleId: styleReference(internals, 'fillStyleId', mixed),
    strokeStyleId: styleReference(internals, 'strokeStyleId', mixed),
    effectStyleId: styleReference(internals, 'effectStyleId', mixed),
    gridStyleId: styleReference(internals, 'gridStyleId', mixed),
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
