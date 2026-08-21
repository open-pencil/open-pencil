import { useClipboard } from '@vueuse/core'
import { computed, inject, provide, proxyRefs, ref, watch } from 'vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useI18n } from '@open-pencil/vue'

import { DEFAULT_COLLAB_STATE, useCollabInjected } from '@/app/collab/use'
import { useNotificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import { getShareURL } from '@/constants'

function createCollabPanelContext() {
  const route = useRoute()
  const router = useRouter()
  const collab = useCollabInjected()
  const { copy, copied } = useClipboard({ copiedDuring: 2000 })
  const { common, collaboration } = useI18n()
  const notifications = useNotificationMessages()

  const joinInput = ref('')
  const nameDraft = ref(collab?.state.value.localName ?? '')
  const pendingRoomId = computed(() =>
    typeof route.params.roomId === 'string' ? route.params.roomId : null
  )
  const popoverOpen = ref(!!pendingRoomId.value)
  const state = computed(() => collab?.state.value ?? DEFAULT_COLLAB_STATE)
  const peers = computed(() => collab?.remotePeers.value ?? [])
  const followingPeer = computed(() => collab?.followingPeer.value ?? null)
  const shareURL = computed(() => {
    if (!state.value.roomId) return ''
    return getShareURL(state.value.roomId)
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
    if (!shareURL.value) return
    void copy(shareURL.value)
    toast.info(notifications.value.linkCopied)
  }

  function share() {
    if (!collab || !nameDraft.value.trim()) return
    collab.setLocalName(nameDraft.value.trim())
    const roomId = collab.shareCurrentDoc()
    void router.push(`/share/${roomId}`)
    void copy(getShareURL(roomId))
    toast.info(notifications.value.linkCopied)
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
    common,
    messages: collaboration,
    copied,
    joinInput,
    nameDraft,
    popoverOpen,
    state,
    peers,
    followingPeer,
    shareURL,
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
