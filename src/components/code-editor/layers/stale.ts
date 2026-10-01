import { StateEffect, StateField, type ChangeDesc } from '@codemirror/state'

import { setLayerLinks } from './links'

/**
 * Code the canvas could not patch since its layer changed: an attribute written as an
 * expression (`value`), or children that could not be moved into the new layer order.
 */
export type StaleAttribute =
  | { kind: 'value'; from: number; to: number; /** e.g. `w={100}` */ value: string }
  | { kind: 'order'; from: number; to: number }

export const markStaleAttributes = StateEffect.define<readonly StaleAttribute[]>()

/** A block of text moved by a reorder: its range before, and where it starts after. */
export interface MovedBlock {
  from: number
  to: number
  newFrom: number
}

/** Blocks a reorder moved, so positions inside them move with their text. */
export const movedBlocks = StateEffect.define<readonly MovedBlock[]>()

/**
 * Where a position ends up: with its block when a reorder moved it, otherwise mapped like any
 * edit. A replaced span would otherwise collapse positions inside it to its edges.
 */
export function movedPosition(
  moved: readonly MovedBlock[],
  changes: ChangeDesc,
  pos: number,
  assoc: -1 | 1
): number {
  const block = moved.find((candidate) => pos >= candidate.from && pos <= candidate.to)
  return block ? block.newFrom + pos - block.from : changes.mapPos(pos, assoc)
}

/**
 * Expression attributes the canvas could not patch, until the person edits them or the code is
 * linked again. They stay as written; this only says the canvas now differs.
 */
export const staleAttributes = StateField.define<readonly StaleAttribute[]>({
  create: () => [],
  update(value, transaction) {
    if (transaction.effects.some((effect) => effect.is(setLayerLinks))) return []
    let next = value
    if (transaction.docChanged) {
      const { changes } = transaction
      const moved = transaction.effects.flatMap((effect) =>
        effect.is(movedBlocks) ? effect.value : []
      )
      next = next.flatMap((range) => {
        const block = moved.find((m) => range.from >= m.from && range.to <= m.to)
        if (block) {
          const shift = block.newFrom - block.from
          return [{ ...range, from: range.from + shift, to: range.to + shift }]
        }
        if (changes.touchesRange(range.from, range.to)) return []
        return [{ ...range, from: changes.mapPos(range.from, 1), to: changes.mapPos(range.to, -1) }]
      })
    }
    for (const effect of transaction.effects) {
      if (!effect.is(markStaleAttributes)) continue
      const marked = new Set(effect.value.map((range) => range.from))
      next = [...next.filter((range) => !marked.has(range.from)), ...effect.value]
    }
    return next
  }
})
