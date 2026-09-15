import { tryOnScopeDispose } from '@vueuse/core'
import { getCurrentInstance, onDeactivated } from 'vue'

import type { Editor, NodePreview } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

/** Keeps an edit's original targets until its terminal event, even after selection changes. */
export function useNodePreview(editor: Editor) {
  let preview: NodePreview | undefined
  let targets: readonly string[] = []

  function update(ids: readonly string[], changes: Partial<SceneNode>, label: string) {
    if (!preview) {
      if (!ids.length) return
      targets = [...ids]
      preview = editor.beginNodePreview(label)
    }
    for (const id of targets) preview.update(id, changes)
  }

  function commit() {
    preview?.commit()
    preview = undefined
    targets = []
  }

  function cancel() {
    preview?.cancel()
    preview = undefined
    targets = []
  }

  tryOnScopeDispose(cancel)
  if (getCurrentInstance()) onDeactivated(cancel)
  return { update, commit, cancel }
}
