import type { Paragraph } from 'canvaskit-wasm'

import type { SceneNode, StyleRun } from '@open-pencil/scene-graph'
import { copyStyleRuns } from '@open-pencil/scene-graph/copy'
import type { JsonObject } from '@open-pencil/scene-graph/primitives'

export type TextEditSizeSnapshot = Partial<Pick<SceneNode, 'width' | 'height'>>

export type TextEditSnapshot = {
  text: string
  styleRuns: StyleRun[]
  size?: TextEditSizeSnapshot
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
      styleRuns: copyStyleRuns(node.styleRuns),
      size: { width: node.width, height: node.height }
    }
  }
}

export function snapshotTextNode(node: SceneNode | undefined, fallbackText = ''): TextEditSnapshot {
  return {
    text: node?.text ?? fallbackText,
    styleRuns: node ? copyStyleRuns(node.styleRuns) : [],
    size: node ? { width: node.width, height: node.height } : undefined
  }
}

export function resizeTextNodeForEdit(
  node: SceneNode | undefined,
  paragraph: Paragraph | null
): TextEditSizeSnapshot {
  if (!node || !paragraph) return {}
  const changes: TextEditSizeSnapshot = {}
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') {
    const width = Math.ceil(paragraph.getLongestLine())
    if (width > 0 && width !== node.width) changes.width = width
  }
  if (node.textAutoResize === 'HEIGHT' || node.textAutoResize === 'WIDTH_AND_HEIGHT') {
    const height = Math.ceil(paragraph.getHeight())
    if (height > 0 && height !== node.height) changes.height = height
  }
  return changes
}

export function textSnapshotChanged(before: TextEditSnapshot, after: TextEditSnapshot): boolean {
  return (
    before.text !== after.text ||
    !styleRunsEqual(before.styleRuns, after.styleRuns) ||
    (after.size !== undefined && !sizeEqual(before.size ?? {}, after.size))
  )
}

function sizeEqual(a: TextEditSizeSnapshot, b: TextEditSizeSnapshot): boolean {
  return a.width === b.width && a.height === b.height
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
  const aRecord = a as JsonObject
  const bRecord = b as JsonObject
  const aKeys = Object.keys(aRecord)
  const bKeys = Object.keys(bRecord)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => Object.hasOwn(bRecord, key) && deepEqual(aRecord[key], bRecord[key]))
}
