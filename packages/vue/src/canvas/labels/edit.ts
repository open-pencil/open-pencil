import { ref, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

export type CanvasLabelKind = 'section-title' | 'frame-title' | 'component-label'

export interface CanvasLabelEdit {
  nodeId: string
  kind: CanvasLabelKind
  value: string
}

export interface CanvasLabelEditController {
  edit: Ref<CanvasLabelEdit | null>
  start: (kind: CanvasLabelKind, node: SceneNode) => void
  update: (value: string) => void
  commit: () => void
  cancel: () => void
}

export function createCanvasLabelEdit(editor: Editor): CanvasLabelEditController {
  const edit = ref<CanvasLabelEdit | null>(null)

  function start(kind: CanvasLabelKind, node: SceneNode) {
    edit.value = { nodeId: node.id, kind, value: node.name }
    editor.setRenamingLabel(node.id)
  }

  function update(value: string) {
    if (edit.value) edit.value = { ...edit.value, value }
  }

  function commit() {
    const current = edit.value
    if (!current) return
    const node = editor.graph.getNode(current.nodeId)
    if (node) {
      const value = current.value.trim() || node.name
      if (value !== node.name) editor.updateNodeWithUndo(node.id, { name: value }, 'Rename layer')
    }
    edit.value = null
    editor.setRenamingLabel(null)
  }

  function cancel() {
    edit.value = null
    editor.setRenamingLabel(null)
  }

  return { edit, start, update, commit, cancel }
}
