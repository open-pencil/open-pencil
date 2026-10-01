import {
  Annotation,
  EditorSelection,
  type ChangeSpec,
  type EditorState,
  type StateEffect,
  type TransactionSpec
} from '@codemirror/state'

import type { DesignJSXElement } from '@open-pencil/design-jsx'

import { patchAttributes, patchText } from './attributes'
import { patchChildren } from './children'
import type { LayerSnippet, PatchContext } from './context'
import { layerLinkConfig, linkedElements, linkInsertedElements, setLayerBases } from './links'
import { markStaleAttributes, movedBlocks, movedPosition, type MovedBlock } from './stale'
import { elementNode, openingTagOf } from './syntax'

/** Marks changes written from the canvas, so they are not rendered back onto it. */
export const fromLayers = Annotation.define<boolean>()

function sameElement(a: DesignJSXElement, b: DesignJSXElement): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Patches the code where linked layers changed since it was last in sync with them: attribute
 * values, text, and added or removed child layers. Values written as expressions stay as
 * written. Returns `null` when nothing changed.
 */
export function layerPatch(state: EditorState, snippet: LayerSnippet): TransactionSpec | null {
  const describe = state.facet(layerLinkConfig)?.describe
  if (!describe) return null
  const elements = state.field(linkedElements)
  const ctx: PatchContext = {
    state,
    changes: [],
    stale: [],
    rewrites: [],
    insertions: [],
    removed: [],
    snippet
  }
  const bases = new Map<string, DesignJSXElement | null>()
  for (const element of elements) {
    const nodeId = element.nodeIds[0]
    const next = describe(nodeId)
    const base = element.base
    if (!next || !base || sameElement(base, next)) {
      if (next && !base) bases.set(nodeId, next)
      continue
    }
    bases.set(nodeId, next)
    if (ctx.removed.some((range) => element.from >= range.from && element.to <= range.to)) continue
    const node = elementNode(state, element)
    const tag = node && openingTagOf(node)
    if (!node || !tag || next.tag !== base.tag) continue
    patchAttributes(ctx, tag, base, next)
    if (base.text !== next.text) patchText(ctx, node, next.text)
    patchChildren(ctx, node, element, elements, base, next)
  }
  if (bases.size === 0) return null
  return patchTransaction(ctx, bases)
}

/** The changes a patch makes, with the links, bases and markers that describe the result. */
function patchTransaction(
  ctx: PatchContext,
  bases: Map<string, DesignJSXElement | null>
): TransactionSpec {
  const { state } = ctx
  const specs: ChangeSpec[] = [
    ...ctx.changes,
    ...ctx.rewrites.map(({ from, to, text }) => ({ from, to, insert: text })),
    ...ctx.insertions.map(({ at, text }) => ({ from: at, insert: text }))
  ]
  const changes = state.changes(specs)
  const effects: StateEffect<unknown>[] = [setLayerBases.of(bases)]
  if (ctx.stale.length > 0) {
    effects.push(
      markStaleAttributes.of(
        ctx.stale.map((range) => ({
          ...range,
          from: changes.mapPos(range.from, 1),
          to: changes.mapPos(range.to, -1)
        }))
      )
    )
  }
  const moved: MovedBlock[] = []
  for (const rewrite of ctx.rewrites) {
    const start = changes.mapPos(rewrite.from, -1)
    for (const { offset, length, layerIds } of rewrite.links) {
      effects.push(
        linkInsertedElements.of({ from: start + offset, to: start + offset + length, layerIds })
      )
    }
    for (const { from, to, offset } of rewrite.moves)
      moved.push({ from, to, newFrom: start + offset })
  }
  for (const { at, text, offset, layerIds } of ctx.insertions) {
    const from = changes.mapPos(at, -1) + offset
    effects.push(linkInsertedElements.of({ from, to: from + text.length - offset, layerIds }))
  }
  if (moved.length === 0) return { changes, effects }
  effects.push(movedBlocks.of(moved))
  const selection = EditorSelection.create(
    state.selection.ranges.map((range) =>
      EditorSelection.range(
        movedPosition(moved, changes, range.anchor, 1),
        movedPosition(moved, changes, range.head, 1)
      )
    ),
    state.selection.mainIndex
  )
  return { changes, effects, selection }
}
