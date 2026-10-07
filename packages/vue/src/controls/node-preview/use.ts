import { tryOnScopeDispose } from '@vueuse/core'
import { getCurrentInstance, onDeactivated } from 'vue'

import type { Editor, NodePreview } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

/** Keeps an edit's original targets until its terminal event, even after selection changes. */
export function useNodePreview(editor: Editor) {
  let preview: NodePreview | undefined
  let targets: readonly string[] = []

  /** Previews `changes` on every target, or the changes a function gives for each one. */
  function update(
    ids: readonly string[],
    changes: Partial<SceneNode> | ((id: string) => Partial<SceneNode>),
    label: string
  ) {
    if (!preview) {
      if (!ids.length) return
      targets = [...ids]
      preview = editor.beginNodePreview(label)
    }
    try {
      for (const id of targets) {
        preview.update(id, typeof changes === 'function' ? changes(id) : changes)
      }
    } catch (error) {
      cancel()
      throw error
    }
  }

  function takePreview() {
    const current = preview
    preview = undefined
    targets = []
    return current
  }

  function commit() {
    takePreview()?.commit()
  }

  function cancel() {
    takePreview()?.cancel()
  }

  tryOnScopeDispose(cancel)
  if (getCurrentInstance()) onDeactivated(cancel)
  return { update, commit, cancel }
}
