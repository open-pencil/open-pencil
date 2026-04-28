import type { Editor, EditorState } from '@open-pencil/core/editor'

type MobileClipboardState = EditorState & { clipboardHtml: string }

export function createMobileClipboardActions(editor: Editor, state: MobileClipboardState) {
  async function mobileCopy() {
    const transfer = new DataTransfer()
    await editor.writeCopyData(transfer)
    state.clipboardHtml = transfer.getData('text/html')
  }

  async function mobileCut() {
    await mobileCopy()
    editor.deleteSelected()
  }

  function mobilePaste() {
    if (state.clipboardHtml) {
      editor.pasteFromHTML(state.clipboardHtml)
    }
  }

  return { mobileCopy, mobileCut, mobilePaste }
}
