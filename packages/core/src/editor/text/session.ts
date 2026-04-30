import { copyStyleRuns } from '#core/scene-graph/copy'

import type { SceneNode, StyleRun } from '#core/scene-graph'

export type TextEditSnapshot = {
  text: string
  styleRuns: StyleRun[]
}

export type TextEditSession = {
  nodeId: string
  before: TextEditSnapshot
}

export function createTextEditSession(node: SceneNode): TextEditSession {
  return {
    nodeId: node.id,
    before: {
      text: node.text,
      styleRuns: copyStyleRuns(node.styleRuns)
    }
  }
}

export function snapshotTextNode(node: SceneNode | undefined, fallbackText = ''): TextEditSnapshot {
  return {
    text: node?.text ?? fallbackText,
    styleRuns: node ? copyStyleRuns(node.styleRuns) : []
  }
}

export function textSnapshotChanged(before: TextEditSnapshot, after: TextEditSnapshot): boolean {
  return before.text !== after.text || !styleRunsEqual(before.styleRuns, after.styleRuns)
}

function styleRunsEqual(a: StyleRun[], b: StyleRun[]): boolean {
  if (a.length !== b.length) return false
  return a.every((run, index) => styleRunEqual(run, b[index]))
}

function styleRunEqual(a: StyleRun, b: StyleRun): boolean {
  return a.start === b.start && a.length === b.length && styleEqual(a.style, b.style)
}

function styleEqual(a: StyleRun['style'], b: StyleRun['style']): boolean {
  return (
    a.fontWeight === b.fontWeight &&
    a.italic === b.italic &&
    a.textDecoration === b.textDecoration &&
    a.fontSize === b.fontSize &&
    a.fontFamily === b.fontFamily &&
    a.letterSpacing === b.letterSpacing &&
    a.lineHeight === b.lineHeight &&
    fillsEqual(a.fills ?? [], b.fills ?? [])
  )
}

function fillsEqual(
  a: NonNullable<StyleRun['style']['fills']>,
  b: NonNullable<StyleRun['style']['fills']>
) {
  if (a.length !== b.length) return false
  return a.every((fill, index) => deepEqual(fill, b[index]))
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return false
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }
  const aRecord = a as Record<string, unknown>
  const bRecord = b as Record<string, unknown>
  const aKeys = Object.keys(aRecord)
  const bKeys = Object.keys(bRecord)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => Object.hasOwn(bRecord, key) && deepEqual(aRecord[key], bRecord[key]))
}
