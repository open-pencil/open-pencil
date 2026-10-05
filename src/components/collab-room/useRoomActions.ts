import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'

import { useCollaborationMessages, useViewportKind } from '@open-pencil/vue'

import { roomLinkURL } from '@/app/collab/room/links'
import { DEFAULT_COLLAB_STATE, useCollabInjected } from '@/app/collab/use'
import { useNotificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import { getShareURL, IS_BROWSER, IS_TAURI } from '@/constants'

/** What the room screens offer for the active tab's room: its link, a desktop handoff, Leave. */
export function useRoomActions() {
  const collab = useCollabInjected()
  const messages = useCollaborationMessages()
  const notifications = useNotificationMessages()
  const { isMobile } = useViewportKind()
  const { copy, copied } = useClipboard({ copiedDuring: 2000 })

  const state = computed(() => collab?.state.value ?? DEFAULT_COLLAB_STATE)
  const leftRoom = computed(() => collab?.leftRoom.value ?? false)
  /** Whether the room's document has yet to arrive, so its screen shows instead of the editor. */
  const pending = computed(
    () => state.value.status === 'joining' || state.value.status === 'waiting'
  )
  const nameHint = computed(() =>
    state.value.hasChosenName ? null : messages.value.nameHint({ name: state.value.localName })
  )
  // Browsers on a computer can hand the room to the desktop app; phones and the app cannot.
  const desktopLink = computed(() => {
    const roomId = state.value.roomId
    if (!roomId || !IS_BROWSER || IS_TAURI || isMobile.value) return null
    return roomLinkURL(roomId)
  })

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
    copied,
    nameHint,
    desktopLink,
    copyLink,
    leave,
    rename,
    dismissLeftRoomNote
  }
}
