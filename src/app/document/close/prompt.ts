import { shallowRef } from 'vue'

import { IS_TAURI } from '@/constants'

import { confirmDocumentClose, type ClosableDocument, type CloseChoice } from './controller'

export const closePrompt = shallowRef<{ documentName: string } | null>(null)
let resolvePrompt: ((choice: CloseChoice) => void) | null = null
let pending = Promise.resolve()

export function answerClosePrompt(choice: CloseChoice): void {
  const resolve = resolvePrompt
  resolvePrompt = null
  closePrompt.value = null
  resolve?.(choice)
}

export function requestDocumentClose(document: ClosableDocument, documentName: string) {
  const result = pending.then(() =>
    confirmDocumentClose(document, async () => {
      if (IS_TAURI) {
        const { chooseNativeDocumentClose } = await import('./native')
        return chooseNativeDocumentClose(documentName)
      }
      return new Promise<CloseChoice>((resolve) => {
        resolvePrompt = resolve
        closePrompt.value = { documentName }
      })
    })
  )
  pending = result.then(
    () => undefined,
    () => undefined
  )
  return result
}
