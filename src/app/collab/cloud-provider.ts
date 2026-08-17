import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider'
import type { Awareness } from 'y-protocols/awareness'
import type * as Y from 'yjs'

import type { CollaborationTicket } from '@open-pencil/cloud/contract'

export type CloudYjsProviderOptions = {
  ticket: CollaborationTicket
  document: Y.Doc
  awareness: Awareness
  onStatus?: (connected: boolean) => void
  onSynced?: () => void
}

export function createCloudYjsProvider(
  options: CloudYjsProviderOptions
): HocuspocusProvider | null {
  if (options.ticket.provider !== 'hocuspocus' || !options.ticket.serverURL) return null
  return new HocuspocusProvider({
    url: options.ticket.serverURL,
    name: options.ticket.roomId,
    token: options.ticket.token,
    document: options.document,
    awareness: options.awareness,
    onStatus({ status }) {
      options.onStatus?.(status === WebSocketStatus.Connected)
    },
    onSynced() {
      options.onSynced?.()
    }
  })
}
