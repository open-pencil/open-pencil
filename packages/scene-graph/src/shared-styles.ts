import { compact, isEqual, omit, pick } from 'es-toolkit'

import { BLACK } from './constants'
import { copyEffects, copyFills, copyLayoutGrids } from './copy'
import type { SceneGraph } from './graph'
import { newStrokeGeometry } from './node-defaults'
import { randomHex } from './random'
import { styleRunReferences } from './text/references'
import type {
  CharacterStyleOverride,
  SceneNode,
  SharedStyle,
  SharedStyleKind,
  SharedStyleType,
  Stroke
} from './types'

const STYLE_REF_KEYS = {
  fill: 'fillStyleId',
  stroke: 'strokeStyleId',
  text: 'textStyleId',
  effect: 'effectStyleId',
  grid: 'gridStyleId'
} as const satisfies Record<SharedStyleKind, keyof SceneNode>

/** The fields that link a layer to its shared styles. */
export const STYLE_LINK_FIELDS = Object.values(STYLE_REF_KEYS)

/** The shared styles a layer uses: its own, its text ranges', and its vector regions'. */
export function referencedStyleIds(node: SceneNode): string[] {
  return compact([
    ...STYLE_LINK_FIELDS.map((field) => node[field]),
    ...styleRunReferences(node.styleRuns).styles,
    ...(node.vectorNetwork?.regions ?? []).map((region) => region.fillStyleId)
  ])
}

const STYLE_TYPES = {
  fill: 'FILL',
  stroke: 'FILL',
  text: 'TEXT',
  effect: 'EFFECT',
  grid: 'GRID'
} as const satisfies Record<SharedStyleKind, SharedStyleType>

/** The fields a text style gives what uses it; changing one leaves the style. */
export const SHARED_TEXT_STYLE_FIELDS = [
  'fontFamily',
  'fontWeight',
  'italic',
  'fontStyle',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'textDecoration',
  'textCase',
  'fontFeatures'
] as const satisfies readonly (keyof SceneNode)[]

/**
 * The paragraph fields a text style also gives the whole text; a range takes only the character
 * ones. Changing one leaves the style, and a cleared style resets them (live-verified).
 */
const TEXT_STYLE_PARAGRAPH_FIELDS = [
  'paragraphSpacing',
  'paragraphIndent',
  'listSpacing'
] as const satisfies readonly (keyof SceneNode)[]

/** The fields each kind of shared style gives what uses it; changing one leaves the style. */
export const SHARED_STYLE_FIELDS = {
  fill: ['fills'],
  stroke: ['strokes'],
  text: [...SHARED_TEXT_STYLE_FIELDS, ...TEXT_STYLE_PARAGRAPH_FIELDS],
  effect: ['effects'],
  grid: ['layoutGrids']
} as const satisfies Record<SharedStyleKind, readonly (keyof SceneNode)[]>

/** The fields that pick a text's face, which its style name names. */
export const FACE_KEYS = [
  'fontFamily',
  'fontWeight',
  'italic'
] as const satisfies readonly (keyof SceneNode)[]

/**
 * The face name of characters with `style` over the text: their own, none where they set another
 * face without one (as ranges from HTML or `.pen` do), else the text's.
 */
export function rangeFontStyle(
  node: Pick<SceneNode, 'fontStyle'>,
  style: CharacterStyleOverride
): string | null {
  if (style.fontStyle !== undefined) return style.fontStyle
  return FACE_KEYS.some((key) => style[key] !== undefined) ? null : node.fontStyle
}

export function sharedStyleRefKey(kind: SharedStyleKind): (typeof STYLE_REF_KEYS)[SharedStyleKind] {
  return STYLE_REF_KEYS[kind]
}

export function sharedStyleTypeForKind(kind: SharedStyleKind): SharedStyleType {
  return STYLE_TYPES[kind]
}

export function getSharedStyles(graph: SceneGraph, kind: SharedStyleKind): SharedStyle[] {
  const type = sharedStyleTypeForKind(kind)
  const styles: SharedStyle[] = []
  for (const node of graph.getAllNodes()) {
    if (node.sharedStyleType !== type || !node.source.id) continue
    styles.push({ id: node.source.id, nodeId: node.id, name: node.name, type })
  }
  return styles.sort((left, right) => left.name.localeCompare(right.name))
}

/** What a stroke draws along beside its paint: the layer's, not its stroke style's. */
const STROKE_LINE_KEYS = ['weight', 'align', 'cap', 'join', 'dashPattern'] as const

/**
 * Whether new strokes only change how their lines run, keeping every paint. A stroke style gives
 * paints only, so such a write keeps it; any other strokes write leaves it, as setting even the
 * same paints does in Figma (live-verified).
 */
function restylesStrokeLines(current: readonly Stroke[], next: readonly Stroke[]): boolean {
  const paints = (strokes: readonly Stroke[]) =>
    strokes.map((stroke) => omit(stroke, STROKE_LINE_KEYS))
  const lines = (strokes: readonly Stroke[]) =>
    strokes.map((stroke) => STROKE_LINE_KEYS.map((key) => stroke[key]))
  return isEqual(paints(current), paints(next)) && !isEqual(lines(current), lines(next))
}

export function styleDetachmentChanges(
  node: SceneNode,
  changes: Partial<SceneNode>
): Partial<SceneNode> {
  const next = { ...changes }
  for (const [kind, fields] of Object.entries(SHARED_STYLE_FIELDS)) {
    const reference = STYLE_REF_KEYS[kind as SharedStyleKind]
    if (reference in changes || !node[reference]) continue
    if (!fields.some((field) => field in changes)) continue
    if (kind === 'stroke' && changes.strokes && restylesStrokeLines(node.strokes, changes.strokes))
      continue
    next[reference] = null
  }
  // A face named for another family, weight, or slant names none; the new one takes its own name.
  const changesFace = FACE_KEYS.some((key) => key in changes && changes[key] !== node[key])
  if (changesFace && !('fontStyle' in changes) && node.fontStyle) {
    next.fontStyle = null
  }
  return next
}

/** The node of the shared style with `id`, when the document holds one of `type`. */
export function findSharedStyle(
  graph: SceneGraph,
  id: string,
  type: SharedStyleType
): SceneNode | undefined {
  if (!id) return undefined
  for (const node of graph.getAllNodes()) {
    if (node.sharedStyleType === type && node.source.id === id) return node
  }
  return undefined
}

/** A new local style's ID, in the shape Figma gives one: `S:` and a 40-digit hex key. */
export function newSharedStyleId(): string {
  return `S:${randomHex(20)},`
}

const INTERNAL_CANVAS_NAME = 'Internal Only Canvas'

/** The page that holds the document's styles out of view, as a `.fig` file keeps them; made once. */
export function internalCanvas(graph: SceneGraph): SceneNode {
  const existing = graph.getPages(true).find((page) => page.internalOnly)
  if (existing) return existing
  return graph.createNode('CANVAS', graph.rootId, {
    name: INTERNAL_CANVAS_NAME,
    width: 0,
    height: 0,
    internalOnly: true
  })
}

/**
 * A paint style's paints as a layer's strokes: every paint, each keeping the weight, alignment,
 * and line style of the stroke it replaces, or of the layer's first; no paints clear the strokes
 * (Figma desktop 126).
 */
function strokesFromStyle(target: SceneNode, style: SceneNode): SceneNode['strokes'] {
  // Without strokes, the layer keeps the weight and alignment a new stroke takes.
  const fallback: Stroke = target.strokes[0] ?? {
    type: 'SOLID',
    color: BLACK,
    opacity: 1,
    visible: true,
    ...newStrokeGeometry(target)
  }
  return copyFills(style.fills).map((paint, index) => ({
    ...paint,
    ...pick(target.strokes[index] ?? fallback, STROKE_LINE_KEYS)
  }))
}

/**
 * What a layer takes from a shared style it starts using: the style's fields and the reference
 * that keeps it attached. Without the style's node, the reference alone.
 */
export function sharedStylePatch(
  kind: SharedStyleKind,
  target: SceneNode,
  styleId: string,
  style: SceneNode | null
): Partial<SceneNode> {
  const patch: Partial<SceneNode> = { [STYLE_REF_KEYS[kind]]: styleId }
  if (!style) return patch
  if (kind === 'fill') patch.fills = copyFills(style.fills)
  else if (kind === 'stroke') patch.strokes = strokesFromStyle(target, style)
  else if (kind === 'effect') patch.effects = copyEffects(style.effects)
  else if (kind === 'grid') patch.layoutGrids = copyLayoutGrids(style.layoutGrids)
  else Object.assign(patch, structuredClone(pick(style, SHARED_STYLE_FIELDS.text)))
  return patch
}

/** A layer leaving a shared style: it keeps the style's values, without the reference. */
export function sharedStyleDetachPatch(kind: SharedStyleKind): Partial<SceneNode> {
  return { [STYLE_REF_KEYS[kind]]: null }
}
