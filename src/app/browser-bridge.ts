import type { ChatTransport, UIMessage } from 'ai'

import type { CollabReturn } from '@/app/collab/context'
import type { EditorStore } from '@/app/editor/session/create'
import { IS_BROWSER } from '@/constants'

export interface OpenPencilTestHooks {
  writeCount?: () => number
  mockHandle?: FileSystemFileHandle
  savedOpen?: Window['open']
  collab?: Pick<
    CollabReturn,
    'connect' | 'disconnect' | 'updateCursor' | 'updateSelection' | 'setLocalName'
  > & {
    peerCount: () => number
    peerSelections: () => Array<string[] | undefined>
  }
}

export interface OpenPencilWindowAPI {
  getStore?: () => EditorStore
  setChatTransport?: (factory: () => ChatTransport<UIMessage>) => void
  openFile?: (path: string) => Promise<void>
  test?: OpenPencilTestHooks
}

declare global {
  interface Window {
    openPencil?: OpenPencilWindowAPI
  }
}

let activeStore: EditorStore | null = null

function windowAPI(): OpenPencilWindowAPI {
  window.openPencil ??= {}
  window.openPencil.getStore ??= () => {
    if (!activeStore) throw new Error('OpenPencil store not initialized')
    return activeStore
  }
  return window.openPencil
}

export function setOpenPencilStore(store: EditorStore) {
  activeStore = store
  windowAPI()
}

export function exposeCollaborationActions(collab: CollabReturn) {
  if (!IS_BROWSER || !import.meta.env.DEV) return
  if (!new URLSearchParams(window.location.search).has('test')) return
  const testHooks = (windowAPI().test ??= {})
  testHooks.collab = {
    connect: collab.connect,
    disconnect: collab.disconnect,
    updateCursor: collab.updateCursor,
    updateSelection: collab.updateSelection,
    setLocalName: collab.setLocalName,
    peerCount: () => collab.remotePeers.value.length,
    peerSelections: () => collab.remotePeers.value.map((peer) => peer.selection)
  }
}

export function exposeChatTransportOverride(
  setChatTransport: (factory: () => ChatTransport<UIMessage>) => void
) {
  windowAPI().setChatTransport = setChatTransport
}

export function setOpenPencilOpenFileHandler(openFile: (path: string) => Promise<void>) {
  windowAPI().openFile = openFile
}
