import type { HocuspocusProvider } from '@hocuspocus/provider'
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

export async function createCloudYjsProvider(
  options: CloudYjsProviderOptions
): Promise<HocuspocusProvider | null> {
  if (options.ticket.provider !== 'hocuspocus' || !options.ticket.serverURL) return null
  const { HocuspocusProvider, WebSocketStatus } = await import('@hocuspocus/provider')
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
