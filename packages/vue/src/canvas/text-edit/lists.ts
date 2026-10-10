import type { Editor } from '@open-pencil/core/editor'
import {
  paragraphIndexAt,
  paragraphStyleAt,
  paragraphStylesInRange,
  withIndentation,
  withListType,
  type SceneNode,
  type TextListType,
  type TextParagraphStyle
} from '@open-pencil/scene-graph'

/**
 * The characters list changes apply to: the selection or the caret's paragraph while the text
 * is being edited, and the whole text otherwise, as in Figma.
 */
function listRange(store: Editor, node: SceneNode): [number, number] {
  const editor = store.state.editingTextId === node.id ? store.textEditor : null
  if (!editor?.state) return [0, node.text.length]
  return editor.getSelectionRange() ?? [editor.state.cursor, editor.state.cursor]
}

function rangeStyles(node: SceneNode, [start, end]: [number, number]): TextParagraphStyle[] {
  const first = paragraphIndexAt(node.text, start)
  const last = end > start ? paragraphIndexAt(node.text, end - 1) : first
  return Array.from({ length: last - first + 1 }, (_, index) =>
    paragraphStyleAt(node.textParagraphs, first + index)
  )
}

/** The list type of the paragraphs list changes apply to, or `null` when they differ. */
export function listTypeOf(store: Editor, node: SceneNode): TextListType | null {
  const types = new Set(rangeStyles(node, listRange(store, node)).map((style) => style.listType))
  const [type] = types
  return types.size === 1 ? type : null
}

export function createTextListActions(store: Editor) {
  function apply(
    node: SceneNode,
    change: (style: TextParagraphStyle) => TextParagraphStyle,
    label: string
  ) {
    const [start, end] = listRange(store, node)
    const textParagraphs = paragraphStylesInRange(
      node.textParagraphs,
      node.text,
      start,
      end,
      change
    )
    store.updateNodeWithUndo(node.id, { textParagraphs }, label)
    const updated = store.graph.getNode(node.id)
    if (updated) store.textEditor?.rebuildParagraph(updated)
    store.requestRender()
  }

  function setListType(node: SceneNode, listType: TextListType) {
    apply(node, (style) => withListType(style, listType), 'Change list style')
  }

  /** A list shortcut makes the paragraphs that list, or plain when they already are. */
  function toggleListType(node: SceneNode, listType: Exclude<TextListType, 'NONE'>) {
    setListType(node, listTypeOf(store, node) === listType ? 'NONE' : listType)
  }

  /** Nests or unnests list items; returns whether any paragraph was a list item to change. */
  function changeIndentation(node: SceneNode, delta: 1 | -1): boolean {
    const styles = rangeStyles(node, listRange(store, node))
    if (!styles.some((style) => style.listType !== 'NONE')) return false
    apply(
      node,
      (style) =>
        style.listType === 'NONE' ? style : withIndentation(style, style.indentation + delta),
      delta > 0 ? 'Indent list item' : 'Outdent list item'
    )
    return true
  }

  return { setListType, toggleListType, changeIndentation }
}
