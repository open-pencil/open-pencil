import type { Editor } from '#core/editor/create'

import { replaceRanges } from './replace'
import type { FindHit } from './search'

const REPLACE_TEXT_LABEL = 'Replace text'

/**
 * Replaces the matches of `hits` with `replacement` as one undo step and returns how many it
 * replaced. Locked layers are left as they are. Layers inside an instance record an override.
 */
export function replaceHits(
  editor: Pick<Editor, 'graph' | 'undo' | 'updateNodeWithUndo'>,
  hits: readonly FindHit[],
  replacement: string
): number {
  let replaced = 0
  editor.undo.runBatch(REPLACE_TEXT_LABEL, () => {
    for (const hit of hits) {
      const node = hit.locked ? undefined : editor.graph.getNode(hit.nodeId)
      const result = node ? replaceRanges(node, hit.ranges, replacement) : null
      if (!result) continue
      editor.updateNodeWithUndo(hit.nodeId, result, REPLACE_TEXT_LABEL)
      replaced += hit.ranges.length
    }
  })
  return replaced
}
