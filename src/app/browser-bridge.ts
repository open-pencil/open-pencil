import type { ChatTransport, UIMessage } from 'ai'

import type { EditorStore } from '@/app/editor/session/create'

export interface OpenPencilTestHooks {
  writeCount?: () => number
  mockHandle?: FileSystemFileHandle
  savedOpen?: Window['open']
}

export interface OpenPencilWindowAPI {
  store?: EditorStore
  setChatTransport?: (factory: () => ChatTransport<UIMessage>) => void
  openFile?: (path: string) => Promise<void>
  test?: OpenPencilTestHooks
}

declare global {
  interface Window {
    openPencil?: OpenPencilWindowAPI
  }
}

function windowApi(): OpenPencilWindowAPI {
  window.openPencil ??= {}
  return window.openPencil
}

export function setOpenPencilStore(store: EditorStore) {
  windowApi().store = store
}

export function exposeChatTransportOverride(
  setChatTransport: (factory: () => ChatTransport<UIMessage>) => void
) {
  windowApi().setChatTransport = setChatTransport
}

export function setOpenPencilOpenFileHandler(openFile: (path: string) => Promise<void>) {
  windowApi().openFile = openFile
}
