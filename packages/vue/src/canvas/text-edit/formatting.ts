import type { Editor } from '@open-pencil/core'
import {
  fontManager,
  getStyleAt,
  toggleBoldInRange,
  toggleDecorationInRange,
  toggleItalicInRange
} from '@open-pencil/core/text'
import type { SceneNode } from '@open-pencil/scene-graph'

export function createTextFormattingActions(store: Editor) {
  function applyFormatting(nodeId: string, changes: Partial<SceneNode>, label: string) {
    store.runTextEditStep(() => store.updateNodeWithUndo(nodeId, changes, label))
    const updated = store.graph.getNode(nodeId)
    if (updated) store.textEditor?.rebuildParagraph(updated)
    store.requestRender()
  }

  /** Whether the family has the face every character in the range takes with these runs. */
  function rangeOffersFaces(
    node: SceneNode,
    runs: SceneNode['styleRuns'],
    [start, end]: [number, number]
  ) {
    for (let index = start; index < end; index++) {
      const style = getStyleAt(runs, index)
      const weight = style.fontWeight ?? node.fontWeight
      if (!fontManager.offersFace(node.fontFamily, weight, style.italic ?? node.italic))
        return false
    }
    return true
  }

  // A family without the face the toggle would set is left as it is, as in Figma.
  function toggleBold(node: SceneNode) {
    const editor = store.textEditor
    const range = editor?.getSelectionRange()
    if (range) {
      const { runs } = toggleBoldInRange(
        node.styleRuns,
        range[0],
        range[1],
        node.fontWeight,
        node.text.length
      )
      if (!rangeOffersFaces(node, runs, range)) return
      applyFormatting(node.id, { styleRuns: runs }, 'Toggle bold')
    } else {
      const fontWeight = node.fontWeight >= 700 ? 400 : 700
      if (!fontManager.offersFace(node.fontFamily, fontWeight, node.italic)) return
      applyFormatting(node.id, { fontWeight }, 'Toggle bold')
    }
  }

  function toggleItalic(node: SceneNode) {
    const editor = store.textEditor
    const range = editor?.getSelectionRange()
    if (range) {
      const { runs } = toggleItalicInRange(
        node.styleRuns,
        range[0],
        range[1],
        node.italic,
        node.text.length
      )
      if (!rangeOffersFaces(node, runs, range)) return
      applyFormatting(node.id, { styleRuns: runs }, 'Toggle italic')
    } else {
      if (!fontManager.offersFace(node.fontFamily, node.fontWeight, !node.italic)) return
      applyFormatting(node.id, { italic: !node.italic }, 'Toggle italic')
    }
  }

  function toggleUnderline(node: SceneNode) {
    const editor = store.textEditor
    const range = editor?.getSelectionRange()
    if (range) {
      const { runs } = toggleDecorationInRange(
        node.styleRuns,
        range[0],
        range[1],
        'UNDERLINE',
        node.textDecoration,
        node.text.length
      )
      applyFormatting(node.id, { styleRuns: runs }, 'Toggle underline')
    } else {
      applyFormatting(
        node.id,
        { textDecoration: node.textDecoration === 'UNDERLINE' ? 'NONE' : 'UNDERLINE' },
        'Toggle underline'
      )
    }
  }

  return { toggleBold, toggleItalic, toggleUnderline }
}
