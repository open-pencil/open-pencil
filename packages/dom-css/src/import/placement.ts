import { isEqual, pick } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { parseCSSNumber } from '@open-pencil/scene-graph/css'
import { autoLayoutSizingFields } from '@open-pencil/scene-graph/layout'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { DesignElement } from '../types'
import { mergedStyle, pickStyle } from './css-values'

/** Where the engine that styled the document laid a layer out, and its lines of text. */
export interface CapturedBox {
  box: Rect
  lines?: number
}

/** Captured boxes by the id of the layer built for them. */
export type CapturedBoxes = Map<string, CapturedBox>

/**
 * How far, in CSS pixels, a laid-out layer may sit from its captured box and still match: less
 * than a pixel, so an off-by-one, such as a border counted once, is still corrected.
 */
const TOLERANCE = 0.5

const SIZE_FIELDS = [
  'width',
  'height',
  'layoutGrow',
  'layoutAlignSelf',
  'textAutoResize',
  'primaryAxisSizing',
  'counterAxisSizing'
] as const satisfies readonly (keyof SceneNode)[]

/** The element's own box, when its layout was recorded. */
export function capturedBox(element: DesignElement): CapturedBox | undefined {
  const layout = element.layout
  if (!layout) return undefined
  return { box: layout.box, lines: layout.lines?.length }
}

/**
 * The box of the text an element holds: its content box, inside its padding and borders, where
 * CSS stacks its line boxes. The text's own extent is narrower when it does not fill a line,
 * as a layer that fills its parent's width is wider than its words.
 */
export function capturedTextBox(element: DesignElement): CapturedBox | undefined {
  const layout = element.layout
  if (!layout?.lines || layout.lines.length === 0) return undefined
  const style = mergedStyle(element)
  const inset = (side: 'top' | 'right' | 'bottom' | 'left') =>
    (parseCSSNumber(pickStyle(style, `padding-${side}`)) ?? 0) +
    (parseCSSNumber(pickStyle(style, `border-${side}-width`)) ?? 0)
  const { x, y, width, height } = layout.box
  return {
    box: {
      x: x + inset('left'),
      y: y + inset('top'),
      width: width - inset('left') - inset('right'),
      height: height - inset('top') - inset('bottom')
    },
    lines: layout.lines.length
  }
}

function relativeTo(rect: Rect, origin: Rect): Rect {
  return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height }
}

/** Text's height follows its lines as it measures them, so only its width is compared. */
function sizeDiffers(node: SceneNode, rect: Rect): boolean {
  const width = Math.abs(node.width - rect.width) > TOLERANCE
  return node.type === 'TEXT' ? width : width || Math.abs(node.height - rect.height) > TOLERANCE
}

function differs(node: SceneNode, rect: Rect): boolean {
  return (
    Math.abs(node.x - rect.x) > TOLERANCE ||
    Math.abs(node.y - rect.y) > TOLERANCE ||
    sizeDiffers(node, rect)
  )
}

function hasAutoLayout(node: SceneNode): boolean {
  return node.layoutMode !== 'NONE' && node.layoutMode !== 'GRID'
}

/**
 * Gives a layer the size it was captured at, and returns whether that changed it. Text that
 * sizes to its content keeps measuring its own width when it took one line, so a font a little
 * wider than the page's does not wrap it; its height follows its lines either way.
 */
function fixSize(node: SceneNode, captured: CapturedBox): boolean {
  const before = pick(node, SIZE_FIELDS)
  node.layoutGrow = 0
  if (node.layoutAlignSelf === 'STRETCH') node.layoutAlignSelf = 'AUTO'
  if (node.type === 'TEXT') {
    if ((captured.lines ?? 1) > 1 || node.textAutoResize !== 'WIDTH_AND_HEIGHT') {
      node.width = captured.box.width
      node.textAutoResize = 'HEIGHT'
    }
  } else {
    node.width = captured.box.width
    node.height = captured.box.height
    const mode = node.layoutMode
    if (mode !== 'NONE' && mode !== 'GRID') {
      Object.assign(node, autoLayoutSizingFields(mode, 'FIXED', 'FIXED'))
    }
  }
  return !isEqual(pick(node, SIZE_FIELDS), before)
}

/** Places the page's top-level layers where the page had them, at the size it gave them. */
export function placeTopLevelLayers(graph: SceneGraph, pageId: string, boxes: CapturedBoxes): void {
  for (const node of graph.getChildren(pageId)) {
    const captured = boxes.get(node.id)
    if (!captured) continue
    node.x = captured.box.x
    node.y = captured.box.y
    fixSize(node, captured)
  }
}

/** Positions a container's children where they were captured, instead of by auto layout. */
function placeChildren(graph: SceneGraph, node: SceneNode, own: CapturedBox, boxes: CapturedBoxes) {
  node.layoutMode = 'NONE'
  node.width = own.box.width
  node.height = own.box.height
  for (const child of graph.getChildren(node.id)) {
    const captured = boxes.get(child.id)
    if (!captured) continue
    const rect = relativeTo(captured.box, own.box)
    child.x = rect.x
    child.y = rect.y
    fixSize(child, { ...captured, box: rect })
  }
}

/**
 * Compares laid-out layers with where the page laid their elements out, and keeps auto layout
 * only where it reproduces them: a layer of the wrong size takes its captured size, and a
 * container whose children land elsewhere places them at their captured boxes instead. Returns
 * how many layers changed, so the caller lays out again until none do.
 */
export function placeLayersFromLayout(graph: SceneGraph, boxes: CapturedBoxes): number {
  let changed = 0
  for (const page of graph.getPages()) {
    for (const { node } of graph.flattenTree(page.id)) {
      const own = boxes.get(node.id)
      if (!own || node.type === 'CANVAS') continue
      if (sizeDiffers(node, own.box) && fixSize(node, own)) changed++
      if (!hasAutoLayout(node)) continue
      const misplaced = graph.getChildren(node.id).some((child) => {
        const captured = boxes.get(child.id)
        return captured !== undefined && differs(child, relativeTo(captured.box, own.box))
      })
      if (misplaced) {
        placeChildren(graph, node, own, boxes)
        changed++
      }
    }
  }
  return changed
}
