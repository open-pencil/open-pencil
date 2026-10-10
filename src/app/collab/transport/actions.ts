import type { CollabAction, CollabActionReceiver } from './types'

/** Names room channels on a transport and delivers what arrives on each to its one receiver. */
export function createActionRegistry(
  send: (namespace: string, data: Uint8Array, peerId?: string) => void
) {
  const receivers = new Map<string, CollabActionReceiver>()
  return {
    makeAction: (namespace: string): CollabAction => [
      (data, peerId) => send(namespace, data, peerId),
      (handler) => {
        if (receivers.has(namespace)) {
          throw new Error(`Collaboration action ${namespace} is already registered`)
        }
        receivers.set(namespace, handler)
      }
    ],
    deliver(namespace: string, data: Uint8Array, peerId: string) {
      receivers.get(namespace)?.(data, peerId)
    },
    clear() {
      receivers.clear()
    }
  }
}
