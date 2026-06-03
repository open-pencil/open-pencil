import type { ChatTransport, UIMessage } from 'ai'

import type { EditorStore } from '@/app/editor/session/create'

export interface InklyTestHooks {
  writeCount?: () => number
  mockHandle?: FileSystemFileHandle
  savedOpen?: Window['open']
}

export interface InklyWindowAPI {
  getStore?: () => EditorStore
  setChatTransport?: (factory: () => ChatTransport<UIMessage>) => void
  openFile?: (path: string) => Promise<void>
  test?: InklyTestHooks
}

declare global {
  interface Window {
    inkly?: InklyWindowAPI
  }
}

let activeStore: EditorStore | null = null

function windowApi(): InklyWindowAPI {
  window.inkly ??= {}
  window.inkly.getStore ??= () => {
    if (!activeStore) throw new Error('Inkly store not initialized')
    return activeStore
  }
  return window.inkly
}

export function setInklyStore(store: EditorStore) {
  activeStore = store
  windowApi()
}

export function exposeChatTransportOverride(
  setChatTransport: (factory: () => ChatTransport<UIMessage>) => void
) {
  windowApi().setChatTransport = setChatTransport
}

export function setInklyOpenFileHandler(openFile: (path: string) => Promise<void>) {
  windowApi().openFile = openFile
}
