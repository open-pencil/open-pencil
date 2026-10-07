import { useClipboard } from '@vueuse/core'
import { computed, inject, provide, proxyRefs, ref, watch } from 'vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useJoinRoom } from '@/app/collab/join'
import { DEFAULT_COLLAB_STATE, useCollabInjected } from '@/app/collab/use'
import { useActiveEditorStoreRef } from '@/app/editor/active-store'
import { useNotificationMessages } from '@/app/i18n/notifications'
import { presenceOf, renameAgent } from '@/app/presence/registry'
import type { FollowTarget } from '@/app/presence/types'
import { toast } from '@/app/shell/ui'
import { presenceRows as buildPresenceRows } from '@/components/presence/rows'
import { getShareURL } from '@/constants'

function createCollabPanelContext() {
  const collab = useCollabInjected()
  const joinRoomFromInput = useJoinRoom()
  const { copy, copied } = useClipboard({ copiedDuring: 2000 })
  const { common, collaboration } = useI18n()
  const notifications = useNotificationMessages()

  const state = computed(() => collab?.state.value ?? DEFAULT_COLLAB_STATE)
  const joinInput = ref('')
  const joinError = ref(false)
  const nameDraft = ref('')
  const popoverOpen = ref(false)
  // Each time the panel opens it shows the current name, or stays empty while the person has
  // none of their own, so the field shows the generated one as its placeholder.
  watch(
    popoverOpen,
    (open) => {
      if (open) nameDraft.value = state.value.hasChosenName ? state.value.localName : ''
    },
    { immediate: true }
  )
  const peers = computed(() => collab?.remotePeers.value ?? [])
  const following = computed(() => collab?.following.value ?? null)
  const storeRef = useActiveEditorStoreRef()
  const presenceRows = computed(() => {
    const store = storeRef.value
    return buildPresenceRows(
      {
        name: state.value.localName,
        color: state.value.localColor,
        agents: store ? presenceOf(store).agents.value : []
      },
      peers.value,
      (pageId) => store?.graph.getNode(pageId)?.name
    )
  })
  const shareURL = computed(() => (state.value.roomId ? getShareURL(state.value.roomId) : ''))

  function copyLink() {
    if (!shareURL.value) return
    void copy(shareURL.value)
    toast.info(notifications.value.linkCopied)
  }

  function saveName() {
    const name = nameDraft.value.trim()
    if (name && name !== state.value.localName) collab?.setLocalName(name)
  }

  function share() {
    if (!collab) return
    saveName()
    const roomId = collab.shareCurrentDoc()
    if (!roomId) return
    void copy(getShareURL(roomId))
    toast.info(notifications.value.linkCopied)
    popoverOpen.value = false
  }

  function join() {
    saveName()
    if (!joinRoomFromInput(joinInput.value)) {
      joinError.value = true
      return
    }
    joinInput.value = ''
    joinError.value = false
    popoverOpen.value = false
  }

  function clearJoinError() {
    joinError.value = false
  }

  function disconnect() {
    collab?.disconnect()
    popoverOpen.value = false
  }

  function follow(target: FollowTarget | null) {
    collab?.follow(target)
  }

  function renameLocalAgent(agentId: string, name: string) {
    if (storeRef.value) renameAgent(storeRef.value, agentId, name)
  }

  return {
    common,
    messages: collaboration,
    copied,
    joinInput,
    joinError,
    nameDraft,
    popoverOpen,
    state,
    following,
    presenceRows,
    shareURL,
    copyLink,
    saveName,
    share,
    join,
    clearJoinError,
    disconnect,
    follow,
    renameLocalAgent
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
