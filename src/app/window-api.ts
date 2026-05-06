import type { ChatTransport, UIMessage } from 'ai'

import type { EditorStore } from '@/app/editor/session/create'

export interface OpenPencilWindowAPI {
  store?: EditorStore
  setTransport?: (factory: () => ChatTransport<UIMessage>) => void
  openFile?: (path: string) => Promise<void>
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

export function setOpenPencilTransportFactorySetter(
  setTransport: (factory: () => ChatTransport<UIMessage>) => void
) {
  windowApi().setTransport = setTransport
}

export function setOpenPencilOpenFileHandler(openFile: (path: string) => Promise<void>) {
  windowApi().openFile = openFile
}
