import type { Editor, EditorState } from '@open-pencil/core/editor'

type MobileClipboardState = EditorState & { clipboardHTML: string }

export function createMobileClipboardActions(editor: Editor, state: MobileClipboardState) {
  async function mobileCopy() {
    const transfer = new DataTransfer()
    await editor.writeCopyData(transfer)
    state.clipboardHTML = transfer.getData('text/html')
  }

  async function mobileCut() {
    await mobileCopy()
    editor.deleteSelected()
  }

  function mobilePaste() {
    if (state.clipboardHTML) {
      void editor.pasteFromHTML(state.clipboardHTML)
    }
  }

  return { mobileCopy, mobileCut, mobilePaste }
}
