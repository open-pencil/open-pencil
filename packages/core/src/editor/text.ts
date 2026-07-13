import type { SceneNode } from '@open-pencil/scene-graph'

import { weightToStyle } from '#core/text/fonts'
import { hasGlyphOutlines } from '#core/text/opentype'

import {
  createTextEditSession,
  resizeTextNodeForEdit,
  snapshotTextNode,
  textSnapshotChanged,
  type TextEditSession
} from './text/session'
import type { EditorContext } from './types'

/**
 * Path text is edited by re-flowing glyph OUTLINES along its path. When the font
 * is unavailable we can't produce new glyphs, so editing would corrupt the baked
 * lettering — treat it as a baked graphic and refuse to enter edit mode. Non-path
 * text still edits (system-font fallback); path text with the font available
 * edits fully (add/remove characters reflow). "Available" is deliberately broad:
 * today that means loaded locally, but a future remote provider (e.g. Google
 * Fonts) would extend hasGlyphOutlines without changing this gate.
 */
function isPathTextEditable(node: SceneNode): boolean {
  if (!node.textPathBox) return true
  return hasGlyphOutlines(node.fontFamily, weightToStyle(node.fontWeight, node.italic))
}

export function createTextActions(ctx: EditorContext) {
  let activeSession: TextEditSession | null = null

  function startTextEditing(nodeId: string) {
    const te = ctx.getTextEditor()
    if (ctx.state.editingTextId) commitTextEdit()
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    // Font-gated: unavailable-font path text stays a non-editable baked graphic.
    if (!isPathTextEditable(node)) return
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

    ctx.graph.updateNode(result.nodeId, {
      text: after.text,
      styleRuns: after.styleRuns,
      ...sizeChanges
    })
    ctx.state.editingTextId = null
    activeSession = null

    ctx.undo.push({
      label: 'Edit text',
      forward: () => {
        ctx.graph.updateNode(result.nodeId, {
          text: after.text,
          styleRuns: after.styleRuns,
          ...after.size
        })
      },
      inverse: () => {
        ctx.graph.updateNode(result.nodeId, {
          text: before.text,
          styleRuns: before.styleRuns,
          ...before.size
        })
      }
    })
  }

  return { startTextEditing, commitTextEdit }
}
