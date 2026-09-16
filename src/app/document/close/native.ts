import { message } from '@tauri-apps/plugin-dialog'
import type { MessageDialogOptions, MessageDialogResult } from '@tauri-apps/plugin-dialog'

import { commonMessages, filesMessages } from '@open-pencil/vue'

import type { CloseChoice } from './controller'

export type NativeMessageDialog = (
  message: string,
  options?: MessageDialogOptions
) => Promise<MessageDialogResult>

/** Desktop uses the platform alert so the choice matches the rest of the operating system. */
export async function chooseNativeDocumentClose(
  documentName: string,
  show: NativeMessageDialog = message
): Promise<CloseChoice> {
  const files = filesMessages.get()
  const common = commonMessages.get()
  const result = await show(files.saveBeforeClosingDescription, {
    title: files.saveBeforeClosing({ name: documentName }),
    kind: 'warning',
    buttons: { yes: common.save, no: files.discard, cancel: common.cancel }
  })
  if (result === common.save) return 'save'
  if (result === files.discard) return 'discard'
  return 'cancel'
}
