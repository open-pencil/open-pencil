import { isEqual, pick } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import { autoLayoutSizingFields, layoutSizingUpdates } from '@open-pencil/scene-graph/layout'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { DesignElement } from '../types'
import { contentInsets } from './box'
import { mergedStyle } from './css-values'

/**
 * Where the engine that styled the document laid a layer out. For text, `box` is the box its
 * lines stack in, `lines` how many there are, and `extent` the box the words themselves take.
 */
export interface CapturedBox {
  box: Rect
  lines?: number
  extent?: Rect
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

/** The fields that say how a layer sizes, as opposed to the size it has. */
const SIZING_MODE_FIELDS = SIZE_FIELDS.filter((field) => field !== 'width' && field !== 'height')

const PAGE_ORIGIN: Rect = { x: 0, y: 0, width: 0, height: 0 }

/** The element's own box, when its layout was recorded, and the extent of its words. */
export function capturedBox(element: DesignElement): CapturedBox | undefined {
  const layout = element.layout
  if (!layout) return undefined
  // An inline element's text runs along its fragments, one on each line it spans.
  const lines = layout.lines ?? layout.fragments ?? []
  return lines.length > 0
    ? { box: layout.box, lines: lines.length, extent: computeBounds(lines) }
    : { box: layout.box }
}

/**
 * The box of the text an element holds: its content box, inside its padding and borders, where
 * CSS stacks its line boxes. The words take less when they do not fill a line, as a layer that
 * fills its parent's width is wider than its words.
 */
export function capturedTextBox(element: DesignElement): CapturedBox | undefined {
  const layout = element.layout
  if (!layout?.lines || layout.lines.length === 0) return undefined
  const insets = contentInsets(mergedStyle(element))
  const { x, y, width, height } = layout.box
  return {
    box: {
      x: x + insets.left,
      y: y + insets.top,
      width: width - insets.left - insets.right,
      height: height - insets.top - insets.bottom
    },
    lines: layout.lines.length,
    extent: computeBounds(layout.lines)
  }
}

/** Text the page set on one line, which keeps to one line and measures its own width. */
function isSingleLine(node: SceneNode, captured: CapturedBox): boolean {
  return node.type === 'TEXT' && captured.lines === 1
}

/**
 * Prepares a text layer for its captured lines: text the page set on one line sizes to its
 * words, so a fallback font a little wider than the page's does not wrap it. It hugs them on
 * both axes, opting out of a stretch its parent gives its children, rather than filling its
 * parent, which would make it wrapping text of the parent's width again.
 */
export function applyCapturedLines(
  graph: SceneGraph,
  node: SceneNode,
  captured: CapturedBox
): void {
  if (!isSingleLine(node, captured)) return
  for (const axis of ['HORIZONTAL', 'VERTICAL'] as const) {
    Object.assign(node, layoutSizingUpdates(graph, node, axis, 'HUG'))
  }
  // Each axis's update reads the other's sizing as it was, so the text's own resizing is set last.
  node.textAutoResize = 'WIDTH_AND_HEIGHT'
}

function offset(rect: Rect, origin: Rect): Rect {
  return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height }
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE
}

/**
 * Whether a layer is the size it was captured at. Text's height follows its lines as it
 * measures them, and a single line's width follows its font, so neither is compared.
 */
function sizeMatches(node: SceneNode, captured: CapturedBox): boolean {
  if (isSingleLine(node, captured)) return true
  if (!near(node.width, captured.box.width)) return false
  return node.type === 'TEXT' || near(node.height, captured.box.height)
}

/**
 * Whether a single line of text starts where its words did. Centered or right-aligned words
 * move by up to the difference between the two fonts' widths, so that much is allowed.
 */
function lineMatches(node: SceneNode, captured: CapturedBox, origin: Rect): boolean {
  const words = offset(captured.extent ?? captured.box, origin)
  return Math.abs(node.x - words.x) <= TOLERANCE + Math.abs(node.width - words.width)
}

/** Whether a layer sits where it was captured relative to `origin`. */
function matches(node: SceneNode, captured: CapturedBox, origin: Rect): boolean {
  const rect = offset(captured.box, origin)
  if (!near(node.y, rect.y)) return false
  if (isSingleLine(node, captured)) return lineMatches(node, captured, origin)
  return near(node.x, rect.x) && sizeMatches(node, captured)
}

function hasAutoLayout(node: SceneNode): boolean {
  return node.layoutMode !== 'NONE' && node.layoutMode !== 'GRID'
}

/** Gives a layer the size it was captured at, and returns whether that changed it. */
function fixSize(node: SceneNode, captured: CapturedBox): boolean {
  const before = pick(node, SIZE_FIELDS)
  node.layoutGrow = 0
  if (node.layoutAlignSelf === 'STRETCH') node.layoutAlignSelf = 'AUTO'
  if (node.type === 'TEXT') {
    if (!isSingleLine(node, captured)) {
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

/** Moves a layer to where it was captured relative to `origin`; a single line where its words were. */
function place(node: SceneNode, captured: CapturedBox, origin: Rect): void {
  const rect = offset(captured.box, origin)
  const words =
    isSingleLine(node, captured) && captured.extent ? offset(captured.extent, origin) : rect
  node.x = words.x
  node.y = rect.y
  fixSize(node, captured)
}

/** Places the page's top-level layers where the page had them, at the size it gave them. */
export function placeTopLevelLayers(graph: SceneGraph, pageId: string, boxes: CapturedBoxes): void {
  for (const node of graph.getChildren(pageId)) {
    const captured = boxes.get(node.id)
    if (captured) place(node, captured, PAGE_ORIGIN)
  }
}

/** Positions a container's children where they were captured, instead of by auto layout. */
function placeChildren(graph: SceneGraph, node: SceneNode, own: CapturedBox, boxes: CapturedBoxes) {
  node.layoutMode = 'NONE'
  node.width = own.box.width
  node.height = own.box.height
  for (const child of graph.getChildren(node.id)) {
    const captured = boxes.get(child.id)
    if (captured) place(child, captured, own.box)
  }
}

/**
 * The layers each import has corrected the size of without changing how they size, so a second
 * such correction is known to be layout imposing the size: a parent sizing its child, which
 * placing the parent's children settles. Kept per import by its captured boxes.
 */
const resizedLayers = new WeakMap<CapturedBoxes, Set<string>>()

/**
 * Compares laid-out layers with where the page laid their elements out, and keeps auto layout
 * only where it reproduces them: a layer of the wrong size takes its captured size, and a
 * container whose children land elsewhere places them at their captured boxes instead. Sizes come
 * first: a child a little too large moves the siblings after it, and fixing its size keeps its
 * parent's auto layout, so children are placed only once no layer changes how it sizes. Returns
 * how many layers changed, so the caller lays out again until none do.
 */
export function placeLayersFromLayout(graph: SceneGraph, boxes: CapturedBoxes): number {
  const layers = graph
    .getPages()
    .flatMap((page) => graph.flattenTree(page.id).map(({ node }) => node))
    .filter((node) => node.type !== 'CANVAS' && boxes.has(node.id))
  const resizedBefore = resizedLayers.get(boxes) ?? new Set<string>()
  resizedLayers.set(boxes, resizedBefore)
  const imposed = new Set<string>()
  let changed = 0
  let resized = 0
  for (const node of layers) {
    const own = boxes.get(node.id)
    if (!own || sizeMatches(node, own)) continue
    const sizing = pick(node, SIZING_MODE_FIELDS)
    const changedSize = fixSize(node, own)
    if (!isEqual(pick(node, SIZING_MODE_FIELDS), sizing)) {
      // A layer that sized itself stops doing so.
      changed++
    } else if (changedSize) {
      // Laid out once more at its corrected size, as wrapped text measures its height at a new
      // width; corrected again, its parent imposes the size, and places it below instead.
      if (resizedBefore.has(node.id)) {
        imposed.add(node.id)
      } else {
        resizedBefore.add(node.id)
        resized++
      }
    }
  }
  // Children are placed only once layout has run at the corrected sizes.
  if (changed + resized > 0) return changed + resized
  for (const node of layers) {
    const own = boxes.get(node.id)
    if (!own || !hasAutoLayout(node)) continue
    const misplaced = graph.getChildren(node.id).some((child) => {
      const captured = boxes.get(child.id)
      return captured !== undefined && (imposed.has(child.id) || !matches(child, captured, own.box))
    })
    if (misplaced) {
      placeChildren(graph, node, own, boxes)
      changed++
    }
  }
  return changed
}
