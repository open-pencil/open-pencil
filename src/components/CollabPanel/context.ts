import { useClipboard } from '@vueuse/core'
import { computed, inject, provide, proxyRefs, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { DEFAULT_COLLAB_STATE, useCollabInjected } from '@/app/collab/use'
import { toast } from '@/app/shell/ui'
import { useI18n } from '@open-pencil/vue'

import type { InjectionKey, ShallowUnwrapRef } from 'vue'

function createCollabPanelContext() {
  const route = useRoute()
  const router = useRouter()
  const collab = useCollabInjected()
  const { copy, copied } = useClipboard({ copiedDuring: 2000 })
  const { dialogs } = useI18n()

  const joinInput = ref('')
  const nameDraft = ref(collab?.state.value.localName ?? '')
  const pendingRoomId = computed(() =>
    typeof route.params.roomId === 'string' ? route.params.roomId : null
  )
  const popoverOpen = ref(!!pendingRoomId.value)
  const state = computed(() => collab?.state.value ?? DEFAULT_COLLAB_STATE)
  const peers = computed(() => collab?.remotePeers.value ?? [])
  const followingPeer = computed(() => collab?.followingPeer.value ?? null)
  const shareUrl = computed(() => {
    if (!state.value.roomId) return ''
    return `${window.location.origin}/share/${state.value.roomId}`
  })
  const isJoining = computed(() => !!pendingRoomId.value && !state.value.connected)

  watch(
    pendingRoomId,
    (roomId) => {
      if (!state.value.connected) popoverOpen.value = !!roomId
    },
    { immediate: true }
  )

  function copyLink() {
    if (!shareUrl.value) return
    void copy(shareUrl.value)
    toast.info('Link copied to clipboard')
  }

  function share() {
    if (!collab || !nameDraft.value.trim()) return
    collab.setLocalName(nameDraft.value.trim())
    const roomId = collab.shareCurrentDoc()
    void router.push(`/share/${roomId}`)
    void copy(`${window.location.origin}/share/${roomId}`)
    toast.info('Link copied to clipboard')
    popoverOpen.value = false
  }

  function join() {
    if (!collab) return
    const roomId = pendingRoomId.value || joinInput.value.trim().replace(/.*\/share\//, '')
    if (!roomId || !nameDraft.value.trim()) return
    collab.setLocalName(nameDraft.value.trim())
    collab.connect(roomId)
    void router.push(`/share/${roomId}`)
    popoverOpen.value = false
  }

  function disconnect() {
    if (!collab) return
    collab.disconnect()
    popoverOpen.value = false
    void router.push('/')
  }

  function toggleFollowPeer(clientId: number) {
    collab?.followPeer(followingPeer.value === clientId ? null : clientId)
  }

  return {
    dialogs,
    copied,
    joinInput,
    nameDraft,
    popoverOpen,
    state,
    peers,
    followingPeer,
    shareUrl,
    isJoining,
    copyLink,
    share,
    join,
    disconnect,
    toggleFollowPeer
  }
}

export type CollabPanelContext = ShallowUnwrapRef<ReturnType<typeof createCollabPanelContext>>

const COLLAB_PANEL_KEY: InjectionKey<CollabPanelContext> = Symbol('CollabPanelContext')

export function provideCollabPanel() {
  const ctx = proxyRefs(createCollabPanelContext())
  provide(COLLAB_PANEL_KEY, ctx)
  return ctx
}

export function useCollabPanelContext(): CollabPanelContext {
  const ctx = inject(COLLAB_PANEL_KEY)
  if (!ctx) throw new Error('Collab panel controls must be used within CollabPanel')
  return ctx
}
