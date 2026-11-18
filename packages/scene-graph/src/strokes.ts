import { isEqual } from 'es-toolkit'

import { copyStroke } from './copy'
import type { SceneNode, Stroke } from './types'

/** What a stroke draws along beside its paint. */
export const STROKE_LINE_KEYS = [
  'weight',
  'align',
  'cap',
  'join',
  'dashPattern'
] as const satisfies readonly (keyof Stroke)[]

type StrokeLineKey = (typeof STROKE_LINE_KEYS)[number]

/**
 * The layer field that keeps each line value. Figma keeps one of each per layer; a layer here
 * also keeps them on each stroke, which the renderer draws.
 */
export const STROKE_LINE_FIELDS = {
  weight: 'strokeWeight',
  align: 'strokeAlign',
  cap: 'strokeCap',
  join: 'strokeJoin',
  dashPattern: 'dashPattern'
} as const satisfies Record<StrokeLineKey, keyof SceneNode>

/** The value a stroke draws with; a stroke without a dash draws solid. */
function strokeLine(stroke: Stroke, key: StrokeLineKey): Stroke[StrokeLineKey] {
  return key === 'dashPattern' ? (stroke.dashPattern ?? []) : stroke[key]
}

/** `strokes` with each line field `values` names, as a layer field set alone gives every stroke. */
export function withStrokeLines(
  strokes: readonly Stroke[],
  values: Partial<Pick<Stroke, StrokeLineKey>>
): Stroke[] {
  return strokes.map((stroke) => {
    const next = copyStroke(stroke)
    for (const key of STROKE_LINE_KEYS) {
      const value = values[key]
      if (value !== undefined) Reflect.set(next, key, structuredClone(value))
    }
    return next
  })
}

/**
 * What else `changes` sets so a layer's line fields and its strokes agree: new strokes set the
 * layer's fields to the first stroke's, and a layer field set without strokes goes to every
 * stroke. Strokes win when `changes` sets both, so restoring strokes restores what they draw.
 * Only fields whose value changes are returned, so an instance overrides no more than an edit
 * changed. A layer without strokes keeps its fields for the next stroke (`newStrokeGeometry`).
 */
export function strokeLineChanges(
  node: SceneNode,
  changes: Partial<SceneNode>
): Partial<SceneNode> {
  if (changes.strokes) {
    const first = changes.strokes.at(0)
    if (!first) return {}
    const derived: Partial<SceneNode> = {}
    for (const key of STROKE_LINE_KEYS) {
      const field = STROKE_LINE_FIELDS[key]
      const current = field in changes ? changes[field] : node[field]
      // A stroke without its own cap or join draws with the layer's.
      const value = strokeLine(first, key) ?? current
      if (!isEqual(current, value)) Reflect.set(derived, field, structuredClone(value))
    }
    // Strokes without their own cap or join take the layer's, so every stroke says what it draws.
    const cap = derived.strokeCap ?? changes.strokeCap ?? node.strokeCap
    const join = derived.strokeJoin ?? changes.strokeJoin ?? node.strokeJoin
    if (changes.strokes.some((stroke) => stroke.cap === undefined || stroke.join === undefined)) {
      derived.strokes = changes.strokes.map((stroke) => ({
        ...copyStroke(stroke),
        cap: stroke.cap ?? cap,
        join: stroke.join ?? join
      }))
    }
    return derived
  }
  if (node.strokes.length === 0) return {}
  const values: Partial<Pick<Stroke, StrokeLineKey>> = {}
  for (const key of STROKE_LINE_KEYS) {
    const value = changes[STROKE_LINE_FIELDS[key]]
    if (value !== undefined) Reflect.set(values, key, value)
  }
  const strokes = withStrokeLines(node.strokes, values)
  return isEqual(strokes, node.strokes) ? {} : { strokes }
}
