import type { Editor } from '@open-pencil/core/editor'

import { nameInGroup, reorderedVariableIds } from '@/app/editor/tokens/model'

/**
 * What the token list does to several tokens at once. Each action is one undo step, however
 * many tokens it touches.
 */
export function useTokenActions(editor: Editor, copyName: (name: string) => string) {
  function variable(id: string) {
    return editor.graph.variables.get(id)
  }

  /** Copies each token after its original and returns the copies, in order. */
  function duplicate(ids: readonly string[]): string[] {
    return editor.undo.runBatch('Duplicate variables', () =>
      ids.flatMap((id) => {
        const source = variable(id)
        const copy = source && editor.duplicateVariable(id, copyName(source.name))
        return copy ? [copy] : []
      })
    )
  }

  function moveToGroup(ids: readonly string[], group: string) {
    editor.undo.runBatch('Move variables to group', () => {
      for (const id of ids) {
        const current = variable(id)
        if (!current) continue
        const name = nameInGroup(current.name, group)
        if (name !== current.name) editor.renameVariable(id, name)
      }
    })
  }

  function remove(ids: readonly string[]) {
    editor.undo.runBatch('Delete variables', () => {
      for (const id of ids) editor.removeVariable(id)
    })
  }

  /** Moves a token among the rows on screen; rows a search or filter hides keep their places. */
  function reorder(
    collectionId: string,
    sourceId: string,
    targetIndex: number,
    visibleIds: readonly string[]
  ) {
    const order = editor.graph.variableCollections.get(collectionId)?.variableIds ?? []
    editor.setVariableOrder(
      collectionId,
      reorderedVariableIds(order, visibleIds, sourceId, targetIndex)
    )
  }

  function alias(id: string, modeId: string, aliasId: string) {
    editor.updateVariableValue(id, modeId, { aliasId })
  }

  /** Detaching keeps what the alias resolved to, so nothing on the canvas changes. */
  function detach(id: string, modeId: string) {
    const value = variable(id)?.valuesByMode[modeId]
    if (typeof value !== 'object' || !('aliasId' in value)) return
    // In the edited mode, as the row shows it, not the mode the canvas happens to be in.
    const resolved = editor.graph.resolveVariable(value.aliasId, modeId)
    if (resolved !== undefined) editor.updateVariableValue(id, modeId, structuredClone(resolved))
  }

  return { duplicate, moveToGroup, remove, reorder, alias, detach }
}
