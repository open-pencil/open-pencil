import {
  createTextEditSession,
  resizeTextNodeForEdit,
  snapshotTextNode,
  textSnapshotChanged,
  type TextEditSession
} from './text/session'
import type { EditorContext } from './types'

export function createTextActions(ctx: EditorContext) {
  let activeSession: TextEditSession | null = null

  function startTextEditing(nodeId: string) {
    const te = ctx.getTextEditor()
    if (ctx.state.editingTextId) commitTextEdit()
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    activeSession = createTextEditSession(node)
    ctx.state.editingTextId = nodeId
    if (te) {
      te.setRenderer(ctx.getRenderer())
      te.start(node)
    }
    ctx.requestRender()
  }

  function commitTextEdit() {
    const te = ctx.getTextEditor()
    if (!te?.isActive) {
      ctx.state.editingTextId = null
      activeSession = null
      return
    }
    const textState = te.state
    if (!textState) {
      te.stop()
      ctx.state.editingTextId = null
      activeSession = null
      ctx.requestRender()
      return
    }
    const result = { nodeId: textState.nodeId, text: textState.text }
    const before = activeSession?.before ?? { text: '', styleRuns: [], size: {} }
    const node = ctx.graph.getNode(result.nodeId)
    const after = snapshotTextNode(node, result.text)
    after.text = result.text
    const sizeChanges =
      before.text !== after.text ? resizeTextNodeForEdit(node, textState.paragraph) : {}
    if (Object.keys(sizeChanges).length > 0) after.size = sizeChanges
    const changed = textSnapshotChanged(before, after)

    te.stop()

    if (!changed) {
      ctx.state.editingTextId = null
      activeSession = null
      ctx.requestRender()
      return
    }

    if (after.text) {
      ctx.graph.updateNode(result.nodeId, {
        text: after.text,
        styleRuns: after.styleRuns,
        ...sizeChanges
      })
    } else {
      ctx.graph.deleteNode(result.nodeId)
    }
    const parentId = node?.parentId

    ctx.state.editingTextId = null
    activeSession = null

    ctx.undo.push({
      label: 'Edit text',
      forward: () => {
        if (after.text) {
          ctx.graph.updateNode(result.nodeId, {
            text: after.text,
            styleRuns: after.styleRuns,
            ...sizeChanges
          })
        } else {
          ctx.graph.deleteNode(result.nodeId)
        }
      },
      inverse: () => {
        if (after.text) {
          ctx.graph.createNode('TEXT', parentId as string, {
            id: result.nodeId,
            type: 'TEXT',
            text: before.text,
            styleRuns: before.styleRuns,
            ...before.size
          })
        } else {
          ctx.graph.updateNode(result.nodeId, {
            text: before.text,
            styleRuns: before.styleRuns,
            ...before.size
          })
        }
      }
    })
  }

  return { startTextEditing, commitTextEdit }
}
