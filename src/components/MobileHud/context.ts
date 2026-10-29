import { computed, inject, provide, proxyRefs } from 'vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'
import IconFilePlus from '~icons/lucide/file-plus'
import IconFolderOpen from '~icons/lucide/folder-open'
import IconImageDown from '~icons/lucide/image-down'
import IconSave from '~icons/lucide/save'
import IconZoomIn from '~icons/lucide/zoom-in'

import { useEditorCommands } from '@open-pencil/vue/editor/commands'
import { useI18n } from '@open-pencil/vue/i18n'

import { isCloudBinding, openCloudShare } from '@/app/cloud/integration'
import { DEFAULT_COLLAB_STATE, useCollabInjected } from '@/app/collab/use'
import { useActiveEditorStoreRef, useEditorStore } from '@/app/editor/active-store'
import { useNotificationMessages } from '@/app/i18n/notifications'
import { presenceOf, renameAgent as renameLocalAgent } from '@/app/presence/registry'
import type { FollowTarget } from '@/app/presence/types'
import { openFileDialog } from '@/app/shell/menu/use'
import { useSendLink } from '@/app/shell/share/link'
import { toast } from '@/app/shell/ui'
import { roomStatusText } from '@/components/collab-room/statusText'
import { toolIcons } from '@/components/icons'
import { presenceRows } from '@/components/presence/rows'
import type { ToolbarActionItem } from '@/components/toolbar/types'
import { getShareURL } from '@/constants'

type MenuAction = ToolbarActionItem

function createMobileHudContext() {
  const collab = useCollabInjected()
  const store = useEditorStore()
  const { send } = useSendLink()
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

  /**
   * Shares the document. A Cloud document opens its share dialog, where its server decides who
   * may open it. Anything else goes into a room, shared first if it is not in one, never a room it
   * opened, and its link goes out through the system share sheet, or is copied without one.
   */
  async function share() {
    // A Cloud document shares through its server; signed out, there is nothing to open yet.
    if (isCloudBinding(store.getStorageBinding())) {
      openCloudShare(store)
      return
    }
    if (!collab) return
    const roomId = collabState.value.roomId ?? collab.shareCurrentDoc()
    if (!roomId) return
    const sent = await send(getShareURL(roomId), store.state.documentName)
    if (sent === 'copied') toast.info(notifications.value.linkCopied)
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
