import type { Editor } from '@open-pencil/core/editor'
import {
  paragraphIndexAt,
  paragraphStyleAt,
  paragraphStylesInRange,
  paragraphStylesWithoutSpacing,
  sharedParagraphSpacing,
  withIndentation,
  withListType,
  withParagraphSpacing,
  type SceneNode,
  type TextListType,
  type TextParagraphSpacingField,
  type TextParagraphStyle
} from '@open-pencil/scene-graph'

/**
 * The characters paragraph changes apply to: the selection or the caret's paragraph while the
 * text is being edited, and the whole text otherwise, as in Figma.
 */
function listRange(store: Editor, node: SceneNode): [number, number] {
  const editor = store.state.editingTextId === node.id ? store.textEditor : null
  if (!editor?.state) return [0, node.text.length]
  return editor.getSelectionRange() ?? [editor.state.cursor, editor.state.cursor]
}

function rangeParagraphs(node: SceneNode, [start, end]: [number, number]): [number, number] {
  const first = paragraphIndexAt(node.text, start)
  return [first, end > start ? paragraphIndexAt(node.text, end - 1) : first]
}

function rangeStyles(node: SceneNode, range: [number, number]): TextParagraphStyle[] {
  const [first, last] = rangeParagraphs(node, range)
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

/** The spacing of the paragraphs changes apply to, or `null` when they differ. */
export function paragraphSpacingOf(
  store: Editor,
  node: SceneNode,
  field: TextParagraphSpacingField
): number | null {
  return sharedParagraphSpacing(node, field, ...rangeParagraphs(node, listRange(store, node)))
}

/**
 * The change that gives the paragraphs changes apply to spacing `value`: their own while the
 * text is edited, and the text's for all of them otherwise.
 */
export function paragraphSpacingChanges(
  store: Editor,
  node: SceneNode,
  field: TextParagraphSpacingField,
  value: number
): Partial<SceneNode> {
  if (store.state.editingTextId !== node.id) {
    return {
      [field]: value,
      textParagraphs: paragraphStylesWithoutSpacing(node.textParagraphs, field)
    }
  }
  const [start, end] = listRange(store, node)
  return {
    textParagraphs: paragraphStylesInRange(node.textParagraphs, node.text, start, end, (style) =>
      withParagraphSpacing(style, field, value)
    )
  }
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
    store.runTextEditStep(() => store.updateNodeWithUndo(node.id, { textParagraphs }, label))
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
