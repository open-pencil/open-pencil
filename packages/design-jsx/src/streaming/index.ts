import { TreeFragment } from '@lezer/common'
import { parser } from '@lezer/javascript'

import { projectPreview, type JSXPreviewSnapshot } from './projection'

export type { JSXPreviewNode, JSXPreviewPending, JSXPreviewSnapshot } from './projection'

const jsxParser = parser.configure({ dialect: 'jsx', top: 'SingleExpression' })
const MAX_PREVIEW_SOURCE_LENGTH = 128_000

/**
 * Append-only, non-executing Design JSX preview parser. Own one instance per tool call.
 * Snapshots contain fresh data; later appends never mutate an earlier preview.
 * This is not final JSX validation: unsupported expressions are deliberately deferred.
 * Call append on coalesced chunks, not once per token, to bound projection work.
 */
export function createStreamingJSXParser() {
  let source = ''
  let fragments: readonly TreeFragment[] = []

  function append(chunk: string): JSXPreviewSnapshot {
    if (source.length + chunk.length > MAX_PREVIEW_SOURCE_LENGTH) {
      throw new RangeError('JSX preview source limit exceeded')
    }
    const next = source + chunk
    const changed = TreeFragment.applyChanges(fragments, [
      {
        fromA: source.length,
        toA: source.length,
        fromB: source.length,
        toB: next.length
      }
    ])
    const tree = jsxParser.parse(next, changed)
    const snapshot = projectPreview(tree.topNode, next)
    source = next
    fragments = TreeFragment.addTree(tree)
    return snapshot
  }

  function reset(): void {
    source = ''
    fragments = []
  }

  return { append, reset }
}
