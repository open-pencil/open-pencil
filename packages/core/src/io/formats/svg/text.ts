import { isEqual } from 'es-toolkit/predicate'

import {
  localTransformFromWorld,
  type CharacterStyleOverride,
  type SceneGraph,
  type SceneNode,
  type StyleRun
} from '@open-pencil/scene-graph'
import Matrix from '@open-pencil/scene-graph/matrix'

import type { SVGElementLayer } from '#core/icons/types'
import { estimateTextSize, getTextMeasurer } from '#core/layout/text-measurement'
import { weightToStyle } from '#core/text/font/style'
import type {
  SVGVectorizeResult,
  VectorizedText,
  VectorizedTextPiece
} from '#core/vector/vectorize/svg/to-vectors'

const ALIGN = { start: 'LEFT', middle: 'CENTER', end: 'RIGHT' } as const
/** How much of its width a text anchored this way sits left of `x`. */
const ANCHOR_OFFSET = { start: 0, middle: 0.5, end: 1 } as const

type Run = VectorizedTextPiece['runs'][number]

/** A run's style in the text's own units; `scale` takes SVG units to the import's. */
function runStyle(
  run: Run,
  scale: number
): Required<
  Pick<
    CharacterStyleOverride,
    | 'fontFamily'
    | 'fontSize'
    | 'fontWeight'
    | 'italic'
    | 'letterSpacing'
    | 'textDecoration'
    | 'fills'
  >
> {
  return {
    // Figma imports SVG text in a font it does not know as Inter.
    fontFamily: run.fontFamily ?? 'Inter',
    fontSize: run.fontSize * scale,
    fontWeight: run.fontWeight,
    italic: run.italic,
    letterSpacing: run.letterSpacing * scale,
    textDecoration: run.textDecoration,
    fills: run.fills
  }
}

/** Later runs as style runs over the first run's style, which the layer takes. */
function styleRuns(runs: Run[], scale: number): StyleRun[] {
  const base = runStyle(runs[0], scale)
  const result: StyleRun[] = []
  let start = 0
  for (const run of runs) {
    const style = runStyle(run, scale)
    const override = Object.fromEntries(
      Object.entries(style).filter(
        ([key, value]) => !isEqual(value, base[key as keyof typeof base])
      )
    ) as CharacterStyleOverride
    if (Object.keys(override).length > 0)
      result.push({ start, length: run.text.length, style: override })
    start += run.text.length
  }
  return result
}

/**
 * A text layer sized to its characters and placed as Figma places SVG text: its top a font size
 * above the baseline, its left, centre, or right edge on `x` by `text-anchor`.
 */
function createTextPiece(
  graph: SceneGraph,
  parentId: string,
  piece: VectorizedTextPiece,
  matrix: VectorizedText['matrix'],
  props: Partial<SceneNode>
): SceneNode {
  const scale = Math.hypot(matrix[0], matrix[3]) || 1
  const characters = piece.runs.map((run) => run.text).join('')
  const node = graph.createNode('TEXT', parentId, {
    name: characters,
    ...props,
    ...runStyle(piece.runs[0], scale),
    text: characters,
    styleRuns: styleRuns(piece.runs, scale),
    textAlignHorizontal: ALIGN[piece.anchor],
    textAutoResize: 'WIDTH_AND_HEIGHT',
    lineHeight: null,
    width: 0
  })
  const size = getTextMeasurer()?.(node) ?? estimateTextSize(node)
  const width = size.width / scale
  const left = width * ANCHOR_OFFSET[piece.anchor]
  const world = Matrix.multiply(
    matrix,
    Matrix.translated(piece.x - left, piece.y - piece.runs[0].fontSize),
    Matrix.scaled(1 / scale, 1 / scale)
  )
  const sized = { ...node, width: size.width, height: size.height }
  const place = localTransformFromWorld(sized, world, Matrix.identity())
  graph.updateNode(node.id, { width: size.width, height: size.height, ...place })
  return node
}

/** Text layers for a `<text>`; one with several pieces is a group of them, as in Figma. */
export function createSVGText(
  graph: SceneGraph,
  parentId: string,
  text: VectorizedText,
  element: SVGElementLayer,
  createGroup: (parentId: string, props: Partial<SceneNode>) => string
): void {
  if (text.pieces.length === 1) {
    createTextPiece(graph, parentId, text.pieces[0], text.matrix, {
      ...(element.name ? { name: element.name } : {}),
      opacity: element.opacity
    })
    return
  }
  const groupId = createGroup(parentId, {
    name: element.name ?? 'Group',
    opacity: element.opacity
  })
  for (const piece of text.pieces) createTextPiece(graph, groupId, piece, text.matrix, {})
}

/** The fonts an import's text is drawn in, to load before it is measured and placed. */
export function svgImportFonts(data: Pick<SVGVectorizeResult, 'texts'>): Array<{
  family: string
  style: string
  characters: string
}> {
  const fonts = new Map<string, { family: string; style: string; characters: string }>()
  for (const run of data.texts.flatMap((text) => text.pieces.flatMap((piece) => piece.runs))) {
    const family = run.fontFamily ?? 'Inter'
    const style = weightToStyle(run.fontWeight, run.italic)
    const key = `${family}\u0000${style}`
    const font = fonts.get(key) ?? { family, style, characters: '' }
    fonts.set(key, { ...font, characters: font.characters + run.text })
  }
  return [...fonts.values()]
}
