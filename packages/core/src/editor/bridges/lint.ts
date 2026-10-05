import type { createClipboardActions } from '#core/editor/clipboard'
import type { createNodeActions } from '#core/editor/nodes'
import type { createStructureActions } from '#core/editor/structure'
import type { EditorContext } from '#core/editor/types'
import { applyLintFixes as applyFixes, type LintFixRequest } from '#core/lint/fixes'

type NodeActions = ReturnType<typeof createNodeActions>
type StructureActions = ReturnType<typeof createStructureActions>
type ClipboardActions = ReturnType<typeof createClipboardActions>

export function createLintFixBridge(
  ctx: EditorContext,
  nodes: NodeActions,
  structure: StructureActions,
  clipboard: ClipboardActions
) {
  /** Applies lint fixes that still hold as one undo step; returns how many applied. */
  function applyLintFixes(requests: readonly LintFixRequest[]): number {
    return ctx.undo.runBatch('Fix design issues', () =>
      applyFixes(
        {
          graph: ctx.graph,
          updateNode: (id, changes) => nodes.updateNodeWithUndo(id, changes, 'Fix design issue'),
          bindVariable: nodes.bindVariable,
          convertToFrame: structure.convertGroupToFrame,
          deleteNodes: (ids) => clipboard.deleteNodes(ids)
        },
        requests
      )
    )
  }

  return { applyLintFixes }
}
