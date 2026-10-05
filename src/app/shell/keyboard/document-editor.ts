/**
 * Marks a dialog or panel that edits the document, such as the variables dialog. While it is the
 * topmost open layer, document shortcuts (undo, redo) work in it as they do on the canvas.
 */
export const DOCUMENT_EDITOR_ATTRIBUTE = 'data-document-editor'

const OPEN_LAYER = '[data-dismissable-layer]:not([data-state="closed"])'

/**
 * Whether the topmost open layer edits the document. Layers portal in the order they open, so a
 * menu or picker opened inside the editor comes after it and keeps document shortcuts off.
 */
export function documentEditorOnTop(root: ParentNode = document): boolean {
  const layers = root.querySelectorAll(OPEN_LAYER)
  return layers[layers.length - 1]?.hasAttribute(DOCUMENT_EDITOR_ATTRIBUTE) ?? false
}
