import type { Canvas, Paint } from '@open-pencil/canvaskit'
import type {
  CharacterStyleOverride,
  Fill,
  SceneGraph,
  SceneNode,
  StyleRun
} from '@open-pencil/scene-graph'
import { textVerticalOffset } from '@open-pencil/scene-graph/text'

import { makeFillPaint } from '#core/canvas/fills/paint'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { withTextParagraph } from '#core/canvas/text'
import type { ParagraphBuildOptions } from '#core/canvas/text/paint'
import { hasDecoration } from '#core/text/decorations'

import { drawDecoration, drawKeycapFrames, textLayoutDecorations } from './decorations'

/**
 * A style run's own visible fills, which its characters draw in place of the layer's: none when
 * they are empty or all hidden, as Figma draws such a range, and undefined when it has no fills.
 */
export function ownFills(style: CharacterStyleOverride): Fill[] | undefined {
  return style.fills?.filter((fill) => fill.visible)
}

/** Decoration paints of their own, which a decoration takes in place of its character's fills. */
function ownDecorationPaints(paints: readonly Fill[] | undefined): Fill[] | undefined {
  return paints?.length ? paints.filter((fill) => fill.visible) : undefined
}

function isPlainColour(fills: readonly Fill[]): boolean {
  return (
    fills.length === 1 &&
    fills.every((fill) => fill.type === 'SOLID' && (!fill.blendMode || fill.blendMode === 'NORMAL'))
  )
}

/**
 * Whether the text draws what has paints of its own (style runs with their own fills, and
 * decorations with their own paints) apart from the layer's fills, once, as Figma paints a range's
 * fills in place of every fill of the layer. Paints of one plain colour on a text of one solid
 * fill are drawn in the layer's own pass instead.
 */
export function drawsOwnPaintsApart(node: SceneNode): boolean {
  const lists = [
    ownDecorationPaints(node.textDecorationFills),
    ...node.styleRuns.flatMap((run) => [
      ownFills(run.style),
      ownDecorationPaints(run.style.textDecorationFills)
    ])
  ]
  let ownsPaints = false
  for (const fills of lists) {
    if (!fills) continue
    if (!isPlainColour(fills)) return true
    ownsPaints = true
  }
  if (!ownsPaints) return false
  const layerFills = node.fills.filter((fill) => fill.visible)
  return layerFills.length !== 1 || layerFills.some((fill) => fill.type !== 'SOLID')
}

/** A paint that draws nothing, for the characters a pass leaves to another. */
function clearPaint(r: SkiaRenderer): Paint {
  const paint = new r.ck.Paint()
  paint.setColor(r.ck.TRANSPARENT)
  return paint
}

/**
 * Draws the text in one fill of the layer: all of it, or, when its own paints draw apart, the
 * characters without fills of their own, which leaves those to `drawOwnPaints`.
 */
export function drawLaidOutText(
  r: SkiaRenderer,
  node: SceneNode,
  draw: (options: ParagraphBuildOptions, ownApart: boolean) => void
): void {
  if (!drawsOwnPaintsApart(node)) {
    draw({}, false)
    return
  }
  const clear = clearPaint(r)
  try {
    draw({ rangePaint: (style) => (ownFills(style) ? clear : undefined) }, true)
  } finally {
    clear.delete()
  }
}

/** One paint per fill, made once for all the passes over a text and deleted after them. */
class OwnPaints {
  private readonly paints = new Map<Fill, Paint | null>()

  constructor(
    private readonly r: SkiaRenderer,
    private readonly node: SceneNode,
    private readonly graph: SceneGraph
  ) {}

  of(fill: Fill): Paint | null {
    let paint = this.paints.get(fill)
    if (paint === undefined) {
      paint = makeFillPaint(this.r, fill, this.node, this.graph)
      this.paints.set(fill, paint)
    }
    return paint
  }

  delete(): void {
    for (const paint of this.paints.values()) paint?.delete()
    this.paints.clear()
  }
}

/** The characters of the runs with fills of their own, and their keycap frames, one pass a fill. */
function drawRangePasses(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  paints: OwnPaints,
  clear: Paint
): void {
  let passes = 0
  for (const run of node.styleRuns) passes = Math.max(passes, ownFills(run.style)?.length ?? 0)
  for (let pass = 0; pass < passes; pass++) {
    const paintOf = (style: CharacterStyleOverride) => {
      const fill = ownFills(style)?.[pass]
      return fill ? paints.of(fill) : null
    }
    withTextParagraph(
      r,
      node,
      r.ck.Color4f(0, 0, 0, 1),
      { halfLeading: true, foregroundPaint: clear, rangePaint: (style) => paintOf(style) ?? clear },
      (paragraph) => {
        const y = textVerticalOffset(node, paragraph.getHeight())
        paragraph.draw(canvas, 0, y)
        drawKeycapFrames(r.ck, canvas, node, paragraph, y, (run?: StyleRun) =>
          run ? paintOf(run.style) : null
        )
      }
    )
  }
}

/** The decorations whose paints are not the layer's fills, each in all of its paints. */
function drawOwnDecorations(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  paints: OwnPaints
): void {
  withTextParagraph(
    r,
    node,
    r.ck.Color4f(0, 0, 0, 1),
    { halfLeading: true },
    (layout, prepared) => {
      const y = textVerticalOffset(node, layout.getHeight())
      for (const rect of textLayoutDecorations(node, prepared, y)) {
        if (rect.fills === node.fills) continue
        for (const fill of rect.fills) {
          const paint = fill.visible ? paints.of(fill) : null
          if (paint) drawDecoration(r.ck, canvas, rect, paint)
        }
      }
    }
  )
}

/**
 * Draws what a laid-out text paints in paints of its own, once, after the layer's fills: the
 * runs with fills of their own, one pass per fill so they stack as a layer's do, their keycap
 * frames, and the decorations whose paints are not the layer's. A gradient or an image spans the
 * layer, as in Figma.
 */
export function drawOwnPaints(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  const paints = new OwnPaints(r, node, graph)
  const clear = clearPaint(r)
  try {
    drawRangePasses(r, canvas, node, paints, clear)
    if (hasDecoration(node)) drawOwnDecorations(r, canvas, node, paints)
  } finally {
    paints.delete()
    clear.delete()
  }
}
