import type {
  ColorProfile,
  Fill,
  SceneGraph,
  SceneNode,
  Variable,
  VariableValue
} from '@open-pencil/scene-graph'
import { convertColor } from '@open-pencil/scene-graph/color'
import { copyEffects, copyFill, copyStyleRuns, copyStroke } from '@open-pencil/scene-graph/copy'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { getPageBackgrounds, setPageBackgrounds } from '#core/figma-api/page-backgrounds'

import type { EditorContext } from './types'

/**
 * How a document takes another color profile, as Figma's File color profile dialog offers it:
 * `assign` keeps every stored number and reads it in the new profile, so colors change; `convert`
 * rewrites the numbers so colors look the same, mapping those the new profile cannot show to the
 * nearest it can.
 */
export type DocumentColorProfileMode = 'assign' | 'convert'

type PaintFields = Pick<SceneNode, 'fills' | 'strokes' | 'effects' | 'styleRuns'>

/** What converting changes, before and after, so one undo step can put it back. */
interface ColorChanges {
  layers: Map<string, { before: PaintFields; after: PaintFields }>
  pages: Map<string, { before: readonly Fill[]; after: Fill[] }>
  variables: Map<string, { before: Variable['valuesByMode']; after: Variable['valuesByMode'] }>
}

function convertFill(fill: Fill, convert: (color: Color) => Color): Fill {
  const next = copyFill(fill)
  next.color = convert(fill.color)
  if (fill.gradientStops) {
    next.gradientStops = fill.gradientStops.map((stop) => ({ ...stop, color: convert(stop.color) }))
  }
  return next
}

function paintFields(node: SceneNode): PaintFields {
  return {
    fills: node.fills.map(copyFill),
    strokes: node.strokes.map(copyStroke),
    effects: copyEffects(node.effects),
    styleRuns: copyStyleRuns(node.styleRuns)
  }
}

function convertedPaintFields(node: SceneNode, convert: (color: Color) => Color): PaintFields {
  return {
    fills: node.fills.map((fill) => convertFill(fill, convert)),
    strokes: node.strokes.map((stroke) => ({
      ...copyStroke(stroke),
      color: convert(stroke.color)
    })),
    effects: copyEffects(node.effects).map((effect) => ({
      ...effect,
      color: convert(effect.color)
    })),
    styleRuns: copyStyleRuns(node.styleRuns).map((run) => ({
      ...run,
      style: { ...run.style, fills: run.style.fills?.map((fill) => convertFill(fill, convert)) }
    }))
  }
}

function isColorValue(value: VariableValue | undefined): value is Color {
  return typeof value === 'object' && 'r' in value
}

/** Every stored color in `graph` converted from `from` to `to`, before and after. */
function convertedColors(
  graph: SceneGraph,
  from: ColorProfile,
  to: ColorProfile
): ColorChanges {
  const convert = (color: Color) => convertColor(color, from, to, 'map')
  const changes: ColorChanges = { layers: new Map(), pages: new Map(), variables: new Map() }
  for (const node of graph.getAllNodes()) {
    if (node.type === 'CANVAS') {
      const before = getPageBackgrounds(node)
      changes.pages.set(node.id, {
        before,
        after: before.map((fill) => convertFill(fill, convert))
      })
      continue
    }
    const { fills, strokes, effects, styleRuns } = node
    if (!fills.length && !strokes.length && !effects.length && !styleRuns.length) continue
    changes.layers.set(node.id, {
      before: paintFields(node),
      after: convertedPaintFields(node, convert)
    })
  }
  for (const variable of graph.variables.values()) {
    if (variable.type !== 'COLOR') continue
    const before = structuredClone(variable.valuesByMode)
    const after = Object.fromEntries(
      Object.entries(before).map(([mode, value]) => [
        mode,
        isColorValue(value) ? convert(value) : value
      ])
    )
    changes.variables.set(variable.id, { before, after })
  }
  return changes
}

function applyColorChanges(graph: SceneGraph, changes: ColorChanges, side: 'before' | 'after') {
  for (const [id, change] of changes.layers) {
    if (graph.getNode(id)) graph.updateNode(id, structuredClone(change[side]))
  }
  for (const [id, change] of changes.pages) {
    const page = graph.getNode(id)
    if (page) setPageBackgrounds(graph, page, change[side])
  }
  for (const [id, change] of changes.variables) {
    const variable = graph.variables.get(id)
    if (!variable) continue
    graph.willChangeVariable(id)
    variable.valuesByMode = structuredClone(change[side])
  }
}

export function createColorSpaceActions(ctx: EditorContext) {
  /**
   * Gives the document `colorSpace` as one undo step, assigning it or converting every stored
   * color into it: layers' paints, effects, and text runs, page backgrounds, and color variables.
   */
  function setDocumentColorSpace(
    colorSpace: ColorProfile,
    mode: DocumentColorProfileMode = 'assign'
  ) {
    const previous = ctx.graph.documentColorSpace
    if (previous === colorSpace) return
    const changes =
      mode === 'convert' ? convertedColors(ctx.graph, previous, colorSpace) : undefined

    const apply = (space: ColorProfile, side: 'before' | 'after') => {
      if (changes) applyColorChanges(ctx.graph, changes, side)
      ctx.graph.documentColorSpace = space
      // Assigning a profile changes how every stored colour draws without touching a node, so the
      // renderers' pictures and tiles are rebuilt rather than kept for the new generation.
      for (const renderer of ctx.getRenderers()) renderer.invalidateAllPictures()
      ctx.emitEditorEvent('document:color-space-changed', space)
      ctx.requestRender()
    }

    apply(colorSpace, 'after')
    ctx.undo.push({
      label: mode === 'convert' ? 'Convert color profile' : 'Assign color profile',
      forward: () => apply(colorSpace, 'after'),
      inverse: () => apply(previous, 'before')
    })
  }

  return {
    setDocumentColorSpace
  }
}
