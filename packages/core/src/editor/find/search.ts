import { escapeRegExp } from 'es-toolkit/string'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export interface TextSearchOptions {
  matchCase: boolean
  /** Match only where the characters on either side are not letters, digits, or `_`. */
  wholeWord: boolean
}

export interface TextRange {
  start: number
  end: number
}

export type FindScope = 'page' | 'document'

export interface FindContext {
  scope: FindScope
  /** The page on screen, searched by the `page` scope. */
  pageId: string
}

export interface FindHit {
  nodeId: string
  pageId: string
  /** Matches inside the layer's text, in order. */
  ranges: TextRange[]
  /** The layer, or a layer above it, is locked: found, but never replaced. */
  locked: boolean
}

const WORD_CHARACTER = String.raw`[\p{L}\p{N}_]`

/** The ranges where `query` occurs in `text`. The query is literal text, never a pattern. */
export function textMatchRanges(
  text: string,
  query: string,
  options: TextSearchOptions
): TextRange[] {
  if (!query || !text) return []
  const literal = escapeRegExp(query)
  const source = options.wholeWord
    ? `(?<!${WORD_CHARACTER})${literal}(?!${WORD_CHARACTER})`
    : literal
  const pattern = new RegExp(source, options.matchCase ? 'gu' : 'giu')
  return [...text.matchAll(pattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length
  }))
}

interface TextLayer {
  node: SceneNode
  locked: boolean
}

/** The visible text layers under a page, in the order the layers panel lists them. */
function textLayersUnder(graph: SceneGraph, pageId: string): TextLayer[] {
  const layers: TextLayer[] = []
  const stack = [{ id: pageId, locked: false }]
  for (let entry = stack.pop(); entry; entry = stack.pop()) {
    const node = graph.getNode(entry.id)
    if (!node || node.internalOnly || !node.visible) continue
    const locked = entry.locked || node.locked
    if (node.type === 'TEXT') layers.push({ node, locked })
    // Pushed last-first, so the first child is visited first.
    for (const childId of node.childIds.toReversed()) stack.push({ id: childId, locked })
  }
  return layers
}

/** The text layers holding `query` in the scope, in reading order. Hidden layers are skipped. */
export function findInDocument(
  graph: SceneGraph,
  query: string,
  options: TextSearchOptions,
  context: FindContext
): FindHit[] {
  if (!query) return []
  const pageIds =
    context.scope === 'page' ? [context.pageId] : graph.getPages().map((page) => page.id)
  return pageIds.flatMap((pageId) =>
    textLayersUnder(graph, pageId).flatMap(({ node, locked }) => {
      const ranges = textMatchRanges(node.text, query, options)
      return ranges.length > 0 ? [{ nodeId: node.id, pageId, ranges, locked }] : []
    })
  )
}

/** Total matches over all hits. */
export function countMatches(hits: readonly FindHit[]): number {
  return hits.reduce((sum, hit) => sum + hit.ranges.length, 0)
}
