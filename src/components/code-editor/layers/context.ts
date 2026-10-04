import type { ChangeSpec, EditorState } from '@codemirror/state'

import type { StaleAttribute } from './stale'

/** Snippets of new layers: exported Design JSX and the layer of each element, in order. */
export type LayerSnippet = (nodeId: string) => { code: string; layerIds: string[] } | null

/** Text replacing a range, with the elements in it to link, by offset into the text. */
export interface Rewrite {
  from: number
  to: number
  text: string
  links: Array<{ offset: number; length: number; layerIds: Array<string | null> }>
  /** Blocks kept from the old text: their range there and their offset into the new text. */
  moves: Array<{ from: number; to: number; offset: number }>
}

export interface PatchContext {
  state: EditorState
  changes: ChangeSpec[]
  stale: StaleAttribute[]
  rewrites: Rewrite[]
  insertions: Array<{ at: number; text: string; offset: number; layerIds: string[] }>
  removed: Array<{ from: number; to: number }>
  snippet: LayerSnippet
}
