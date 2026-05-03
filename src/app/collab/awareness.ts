import { ref } from 'vue'

import { PEER_COLORS, ROOM_ID_CHARS, ROOM_ID_LENGTH } from '@/constants'
import { randomIndex } from '@open-pencil/core/random'

import type { RemotePeer } from './types'
import type { EditorStore } from '@/app/editor/active-store'
import type { Color } from '@open-pencil/core/types'
import type * as awarenessProtocol from 'y-protocols/awareness'

type Awareness = awarenessProtocol.Awareness

type CursorState = {
  x: number
  y: number
  pageId: string
  zoom?: number
}

export function buildRemotePeers(
  states: Map<number, Record<string, unknown>>,
  localClientId: number
): RemotePeer[] {
  const peers: RemotePeer[] = []

  states.forEach((peerState, clientId) => {
    if (clientId === localClientId) return
    const user = peerState.user as { name?: string; color?: Color } | undefined
    if (!user) return
    peers.push({
      clientId,
      name: user.name || 'Anonymous',
      color: user.color || PEER_COLORS[clientId % PEER_COLORS.length],
      cursor: peerState.cursor as RemotePeer['cursor'],
      selection: peerState.selection as string[]
    })
  })

  return peers
}

export function remotePeersToCursors(peers: RemotePeer[], currentPageId: string) {
  return peers
    .filter((p) => p.cursor && p.cursor.pageId === currentPageId)
    .map((p) => {
      const cursor = p.cursor as NonNullable<RemotePeer['cursor']>
      return {
        name: p.name,
        color: p.color,
        x: cursor.x,
        y: cursor.y,
        selection: p.selection
      }
    })
}

export function createFollowActions(
  getStore: () => EditorStore,
  getAwareness: () => Awareness | null
) {
  const followingPeer = ref<number | null>(null)

  function followPeer(clientId: number | null) {
    followingPeer.value = clientId
  }

  function resetFollow() {
    followingPeer.value = null
  }

  function tickFollow() {
    const store = getStore()
    const awareness = getAwareness()
    if (!followingPeer.value || !awareness) return
    const peerState = awareness.getStates().get(followingPeer.value)
    if (!peerState?.cursor) {
      followingPeer.value = null
      return
    }
    const cursor = peerState.cursor as CursorState
    if (cursor.pageId !== store.state.currentPageId) {
      void store.switchPage(cursor.pageId)
    }
    const canvas = document.querySelector('canvas')
    if (!canvas) return
    if (cursor.zoom) store.state.zoom = cursor.zoom
    const cw = canvas.width / devicePixelRatio
    const ch = canvas.height / devicePixelRatio
    store.state.panX = cw / 2 - cursor.x * store.state.zoom
    store.state.panY = ch / 2 - cursor.y * store.state.zoom
    store.requestRender()
  }

  return { followingPeer, followPeer, resetFollow, tickFollow }
}

export function generateRoomId(): string {
  let result = ''
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    result += ROOM_ID_CHARS[randomIndex(ROOM_ID_CHARS.length)]
  }
  return result
}
