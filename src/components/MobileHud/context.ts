import { useClipboard } from '@vueuse/core'
import { computed, inject, provide, proxyRefs } from 'vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'
import IconFilePlus from '~icons/lucide/file-plus'
import IconFolderOpen from '~icons/lucide/folder-open'
import IconImageDown from '~icons/lucide/image-down'
import IconSave from '~icons/lucide/save'
import IconZoomIn from '~icons/lucide/zoom-in'

import { useEditorCommands, useI18n } from '@open-pencil/vue'

import { DEFAULT_COLLAB_STATE, useCollabInjected } from '@/app/collab/use'
import { useActiveEditorStoreRef, useEditorStore } from '@/app/editor/active-store'
import { toolIcons } from '@/app/editor/icons'
import { useNotificationMessages } from '@/app/i18n/notifications'
import { presenceOf, renameAgent as renameLocalAgent } from '@/app/presence/registry'
import type { FollowTarget } from '@/app/presence/types'
import { openFileDialog } from '@/app/shell/menu/use'
import { toast } from '@/app/shell/ui'
import { roomStatusText } from '@/components/collab-room/statusText'
import { presenceRows } from '@/components/presence/rows'
import type { ToolbarActionItem } from '@/components/Toolbar/types'
import { getShareURL } from '@/constants'

type MenuAction = ToolbarActionItem

function createMobileHudContext() {
  const collab = useCollabInjected()
  const store = useEditorStore()
  const { copy } = useClipboard()
  const { common, collaboration } = useI18n()
  const notifications = useNotificationMessages()
  const { getCommand } = useEditorCommands()

  const collabState = computed(() => collab?.state.value ?? DEFAULT_COLLAB_STATE)
  const collabPeers = computed(() => collab?.remotePeers.value ?? [])
  const following = computed(() => collab?.following.value ?? null)
  // The active tab's own store: presence is kept per store, and the editor proxy is not one.
  const tabStore = useActiveEditorStoreRef()
  /** You first, then everyone else in the room, each with the agents they run. */
  const people = computed(() => {
    const own = tabStore.value
    return presenceRows(
      {
        name: collabState.value.localName,
        color: collabState.value.localColor,
        agents: own ? presenceOf(own).agents.value : []
      },
      collabPeers.value,
      (pageId) => own?.graph.getNode(pageId)?.name
    )
  })
  const peopleLabel = computed(
    () =>
      `${collaboration.value.inThisRoom}: ${people.value.map((person) => person.name || common.value.you).join(', ')}`
  )
  const activeToolIcon = computed(() => toolIcons[store.state.activeTool])
  const actionToast = computed(() => store.state.actionToast)

  const menuItems: MenuAction[] = [
    {
      icon: IconFilePlus,
      label: 'New',
      action: () => void import('@/app/tabs').then((m) => m.createTab())
    },
    { icon: IconFolderOpen, label: 'Open…', action: () => void openFileDialog() },
    { icon: IconSave, label: 'Save', action: () => void store.saveFigFile() },
    { icon: IconImageDown, label: 'Export…', action: () => void store.exportSelection(1, 'png') },
    { icon: IconZoomIn, label: 'Zoom to fit', action: () => getCommand('view.zoomFit').run() }
  ]

  function undo() {
    getCommand('edit.undo').run()
  }

  function redo() {
    getCommand('edit.redo').run()
  }

  const statusText = computed(() =>
    collabState.value.status
      ? roomStatusText(collaboration.value, collabState.value.status, collabPeers.value.length)
      : ''
  )

  /** Copies the room's link; a tab not in a room is shared first, never a room it opened. */
  function share() {
    if (!collab) return
    const roomId = collabState.value.roomId ?? collab.shareCurrentDoc()
    if (!roomId) return
    void copy(getShareURL(roomId))
    toast.info(notifications.value.linkCopied)
  }

  function disconnect() {
    collab?.disconnect()
  }

  function follow(target: FollowTarget | null) {
    collab?.follow(target)
  }

  function renameAgent(agentId: string, name: string) {
    if (tabStore.value) renameLocalAgent(tabStore.value, agentId, name)
  }

  return {
    store,
    common,
    messages: collaboration,
    collabState,
    people,
    peopleLabel,
    following,
    statusText,
    activeToolIcon,
    actionToast,
    menuItems,
    undo,
    redo,
    share,
    disconnect,
    follow,
    renameAgent
  }
}

export type MobileHudContext = ShallowUnwrapRef<ReturnType<typeof createMobileHudContext>>

const MOBILE_HUD_KEY: InjectionKey<MobileHudContext> = Symbol('MobileHudContext')

export function provideMobileHud() {
  const ctx = proxyRefs(createMobileHudContext())
  provide(MOBILE_HUD_KEY, ctx)
  return ctx
}

export function useMobileHudContext(): MobileHudContext {
  const ctx = inject(MOBILE_HUD_KEY)
  if (!ctx) throw new Error('Mobile HUD controls must be used within MobileHud')
  return ctx
}
