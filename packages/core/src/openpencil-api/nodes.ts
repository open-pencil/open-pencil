import { isEqual } from 'es-toolkit/predicate'

import type {
  LayoutDirection,
  SceneGraph,
  SceneNode,
  TextDirection
} from '@open-pencil/scene-graph'
import {
  getFillOkHCL,
  getStrokeOkHCL,
  setNodeFillOkHCL,
  setNodeStrokeOkHCL,
  type OkHCLColor,
  type OkHCLPayload
} from '@open-pencil/scene-graph/color'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'

import { assertNodeEditable } from '#core/editor/capabilities'
import { assertTextFontsLoaded } from '#core/figma-api/fonts/loaded'
import { textAutoResizeChanges } from '#core/layout/text-auto-resize'
import { markdownText } from '#core/text/markdown'

import { nodeOf, type NodeRef } from './behaviours'

const DIRECTIONS = ['AUTO', 'LTR', 'RTL'] as const

/** Writes a layer's fields as a script edit does: an instance's layer claims what changed. */
function editNode(graph: SceneGraph, node: SceneNode, changes: Partial<SceneNode>): void {
  assertNodeEditable(graph, node.id)
  const changed = Object.keys(changes).filter(
    (key) => !isEqual(Reflect.get(changes, key), Reflect.get(node, key))
  )
  graph.updateNode(node.id, changes)
  recordInstanceOverride(graph, node.id, changed)
}

function direction(value: string): LayoutDirection & TextDirection {
  if (!(DIRECTIONS as readonly string[]).includes(value))
    throw new Error(`Unknown direction ${value}; use ${DIRECTIONS.join(', ')}`)
  return value as LayoutDirection & TextDirection
}

export function readFillOkHCL(graph: SceneGraph, ref: NodeRef, index: number): OkHCLPayload | null {
  return getFillOkHCL(nodeOf(graph, ref), index)
}

export function writeFillOkHCL(
  graph: SceneGraph,
  ref: NodeRef,
  color: OkHCLColor,
  index: number
): void {
  const node = nodeOf(graph, ref)
  editNode(graph, node, setNodeFillOkHCL(node, index, color, graph.documentColorSpace))
}

export function readStrokeOkHCL(
  graph: SceneGraph,
  ref: NodeRef,
  index: number
): OkHCLPayload | null {
  return getStrokeOkHCL(nodeOf(graph, ref), index)
}

export function writeStrokeOkHCL(
  graph: SceneGraph,
  ref: NodeRef,
  color: OkHCLColor,
  index: number
): void {
  const node = nodeOf(graph, ref)
  editNode(graph, node, setNodeStrokeOkHCL(node, index, color, graph.documentColorSpace))
}

/** A frame's auto layout direction; a layer saved without one reads `AUTO`. */
export function readLayoutDirection(graph: SceneGraph, ref: NodeRef): LayoutDirection {
  const node = nodeOf(graph, ref)
  return Object.hasOwn(node, 'layoutDirection') ? node.layoutDirection : 'AUTO'
}

export function writeLayoutDirection(graph: SceneGraph, ref: NodeRef, value: string): void {
  editNode(graph, nodeOf(graph, ref), { layoutDirection: direction(value) })
}

export function readTextDirection(graph: SceneGraph, ref: NodeRef): TextDirection {
  return nodeOf(graph, ref).textDirection
}

export function writeTextDirection(graph: SceneGraph, ref: NodeRef, value: string): void {
  editNode(graph, nodeOf(graph, ref), { textDirection: direction(value) })
}

/** The text, ranges, and paragraphs Markdown gives a text layer, as FigJam styles it. */
export function textMarkdownChanges(node: SceneNode, markdown: string): Partial<SceneNode> {
  if (node.type !== 'TEXT')
    throw new Error(`Markdown is written into a text layer, not ${node.type}`)
  return markdownText(markdown, node)
}

/**
 * Writes Markdown as a text layer's text: its own style stays, and headings, emphasis, code,
 * links, lists, and quotes become ranges and paragraphs. The fonts it uses must be loaded.
 */
export function writeTextMarkdown(graph: SceneGraph, ref: NodeRef, markdown: string): void {
  const node = nodeOf(graph, ref)
  const changes = textMarkdownChanges(node, markdown)
  assertTextFontsLoaded('setTextMarkdown', { ...node, ...changes })
  editNode(graph, node, { ...changes, ...textAutoResizeChanges(node, changes) })
}
