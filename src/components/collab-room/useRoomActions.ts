import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'

import { useViewportKind } from '@open-pencil/vue'

import { roomLinkURL } from '@/app/collab/room/links'
import { showsRoomDocument, type PendingRoomStatus } from '@/app/collab/room/status'
import { DEFAULT_COLLAB_STATE, useCollabInjected } from '@/app/collab/use'
import { useNotificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import { DESKTOP_DOWNLOAD_URL, getShareURL, IS_BROWSER, IS_TAURI } from '@/constants'

/** What the room screens offer for the active tab's room: its link, a desktop handoff, Leave. */
export function useRoomActions() {
  const collab = useCollabInjected()
  const notifications = useNotificationMessages()
  const { isMobile } = useViewportKind()
  const { copy, copied } = useClipboard({ copiedDuring: 2000 })

  const state = computed(() => collab?.state.value ?? DEFAULT_COLLAB_STATE)
  const leftRoom = computed(() => collab?.leftRoom.value ?? false)
  /** Whether the room's document has yet to arrive, so its screen shows instead of the editor. */
  const pendingStatus = computed<PendingRoomStatus | null>(() => {
    const status = state.value.status
    return status && !showsRoomDocument(status) ? status : null
  })
  const pending = computed(() => pendingStatus.value !== null)
  /** Who the file is coming from, while it is on its way. */
  const sender = computed(() => state.value.peers.find((peer) => peer.hasFile)?.name ?? null)
  /** People in the room who are waiting for the file too. */
  const othersWaiting = computed(() =>
    state.value.peers.filter((peer) => !peer.hasFile).map((peer) => peer.name)
  )
  // Browsers on a computer can hand the room to the desktop app; phones and the app cannot.
  const desktopLink = computed(() => {
    const roomId = state.value.roomId
    if (!roomId || !IS_BROWSER || IS_TAURI || isMobile.value) return null
    return roomLinkURL(roomId)
  })
  /** Offered beside the desktop link, for people without the app. */
  const downloadURL = computed(() => (desktopLink.value ? DESKTOP_DOWNLOAD_URL : null))

  function copyLink() {
    const roomId = state.value.roomId
    if (!roomId) return
    void copy(getShareURL(roomId))
    toast.info(notifications.value.linkCopied)
  }

  function leave() {
    collab?.disconnect()
  }

  function rename(name: string) {
    collab?.setLocalName(name)
  }

  function dismissLeftRoomNote() {
    collab?.dismissLeftRoomNote()
  }

  return {
    state,
    leftRoom,
    pending,
    pendingStatus,
    sender,
    othersWaiting,
    copied,
    desktopLink,
    downloadURL,
    copyLink,
    leave,
    rename,
    dismissLeftRoomNote
  }
}
