import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'

export type SyntaxNode = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>

/** The token that ends at or before `pos`, skipping the whitespace between. */
export function tokenBefore(state: EditorState, pos: number): SyntaxNode | null {
  const node = syntaxTree(state).resolveInner(pos, -1)
  return node.type.isTop ? node.childBefore(pos) : node
}

export function nodeText(state: EditorState, node: SyntaxNode) {
  return state.sliceDoc(node.from, node.to)
}
