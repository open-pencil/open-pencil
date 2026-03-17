<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem
} from 'reka-ui'

import IconFilePlus from '~icons/lucide/file-plus'
import IconFolderOpen from '~icons/lucide/folder-open'
import IconImageDown from '~icons/lucide/image-down'
import IconSave from '~icons/lucide/save'
import IconZoomIn from '~icons/lucide/zoom-in'

import { menuContent, menuItem } from '@/components/ui/menu'
import { openFileDialog } from '@/composables/use-menu'
import { DEFAULT_COLLAB_STATE, useCollabInjected } from '@/composables/use-collab'
import { toast } from '@/utils/toast'
import { useEditorStore } from '@/stores/editor'
import Tip from '@/components/Tip.vue'
import { colorToCSS } from '@open-pencil/core'
import { toolIcons } from '@/utils/tools'
import { initials } from '@/utils/text'

import type { Component } from 'vue'

const router = useRouter()
const collab = useCollabInjected()
const store = useEditorStore()
const { copy } = useClipboard()

const collabState = computed(() => collab?.state.value ?? DEFAULT_COLLAB_STATE)
const collabPeers = computed(() => collab?.remotePeers.value ?? [])
const followingPeer = computed(() => collab?.followingPeer.value ?? null)

function onShare() {
  if (!collab) return
  const roomId = collab.shareCurrentDoc()
  router.push(`/share/${roomId}`)
  copy(`${window.location.origin}/share/${roomId}`)
  toast.show('Link copied to clipboard')
}

function onDisconnect() {
  if (!collab) return
  collab.disconnect()
  router.push('/')
}

const activeToolIcon = computed(() => toolIcons[store.state.activeTool])

interface MenuAction {
  icon: Component
  label: string
  action: () => void
}

const menuItems: MenuAction[] = [
  {
    icon: IconFilePlus,
    label: 'New',
    action: () => import('@/stores/tabs').then((m) => m.createTab())
  },
  { icon: IconFolderOpen, label: 'Open…', action: () => openFileDialog() },
  { icon: IconSave, label: 'Save', action: () => store.saveFigFile() },
  {
    icon: IconImageDown,
    label: 'Export…',
    action: () => store.exportSelection(1, 'PNG')
  },
  { icon: IconZoomIn, label: 'Zoom to fit', action: () => store.zoomToFit() }
]

const onlineCount = computed(() => collabPeers.value.length + 1)
</script>

<template>
  <div
    class="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start px-3 pt-3"
    @touchstart.stop
  >
    <!-- Undo / Redo + active tool indicator -->
    <div class="pointer-events-auto flex flex-col items-start gap-1.5">
      <div class="flex gap-1.5">
        <Tip label="Undo">
          <button
            class="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-panel/70 shadow-md backdrop-blur-xl select-none active:bg-hover"
            @click="store.undoAction()"
          >
            <icon-lucide-undo-2 class="size-3.5 text-surface" />
          </button>
        </Tip>
        <Tip label="Redo">
          <button
            class="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-panel/70 shadow-md backdrop-blur-xl select-none active:bg-hover"
            @click="store.redoAction()"
          >
            <icon-lucide-redo-2 class="size-3.5 text-surface" />
          </button>
        </Tip>
      </div>
      <div
        class="flex size-8 items-center justify-center rounded-full border border-accent/20 bg-panel/70 shadow-md backdrop-blur-xl transition-colors duration-200"
      >
        <Transition
          mode="out-in"
          enter-active-class="animate-in fade-in zoom-in-75 duration-150"
          leave-active-class="animate-out fade-out zoom-out-75 duration-150"
        >
          <component
            :is="activeToolIcon"
            :key="store.state.activeTool"
            class="size-3.5 text-accent"
          />
        </Transition>
      </div>
    </div>

    <!-- Center: Online badge + action toast -->
    <div class="pointer-events-auto relative mx-auto flex flex-col items-center gap-1.5">
      <!-- Online badge with peers popover -->
      <PopoverRoot v-if="collabState.connected">
        <PopoverTrigger as-child>
          <button
            class="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-panel/70 px-3 shadow-md backdrop-blur-xl select-none active:bg-hover"
          >
            <span class="size-2 rounded-full bg-green-500" />
            <span class="text-xs text-surface">Online: {{ onlineCount }}</span>
          </button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            :modal="false"
            :side-offset="8"
            side="bottom"
            align="center"
            class="z-50 w-56 rounded-xl border border-border bg-panel p-3 shadow-xl"
          >
            <div class="mb-2 text-[11px] tracking-wider text-muted uppercase">In this room</div>
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <div
                  class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  :style="{ background: colorToCSS(collabState.localColor) }"
                >
                  {{ initials(collabState.localName || 'You') }}
                </div>
                <span class="min-w-0 flex-1 truncate text-xs text-surface">
                  {{ collabState.localName || 'You' }}
                </span>
                <span class="text-[10px] text-muted">you</span>
              </div>

              <div
                v-for="peer in collabPeers"
                :key="peer.clientId"
                class="flex cursor-pointer items-center gap-2 rounded-md px-0.5 py-0.5 select-none active:bg-hover"
                @click="collab?.followPeer(followingPeer === peer.clientId ? null : peer.clientId)"
              >
                <div
                  class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  :class="followingPeer === peer.clientId ? 'ring-2 ring-white/40' : ''"
                  :style="{ background: colorToCSS(peer.color) }"
                >
                  {{ initials(peer.name) }}
                </div>
                <span class="min-w-0 flex-1 truncate text-xs text-surface">{{ peer.name }}</span>
                <span v-if="followingPeer === peer.clientId" class="text-[10px] text-accent"
                  >following</span
                >
              </div>
            </div>

            <button
              class="mt-3 flex h-7 w-full cursor-pointer items-center justify-center rounded border border-border bg-transparent text-xs text-muted select-none active:bg-hover"
              @click="onDisconnect"
            >
              Disconnect
            </button>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>

      <!-- Action toast -->
      <Transition
        enter-active-class="animate-in fade-in duration-150"
        leave-active-class="animate-out fade-out duration-200"
      >
        <div
          v-if="store.state.actionToast"
          :key="store.state.actionToast"
          class="flex h-8 items-center rounded-full border border-accent/20 bg-panel/70 px-3 shadow-md backdrop-blur-xl"
        >
          <span class="text-xs whitespace-nowrap text-accent">{{ store.state.actionToast }}</span>
        </div>
      </Transition>
    </div>

    <!-- Share + Menu -->
    <div class="pointer-events-auto flex items-center gap-1.5">
      <button
        class="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-panel/70 px-3 shadow-md backdrop-blur-xl select-none active:bg-hover"
        @click="onShare"
      >
        <icon-lucide-share-2 class="size-3.5 text-surface" />
        <span class="text-xs text-surface">Share</span>
      </button>

      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <button
            class="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-panel/70 shadow-md backdrop-blur-xl select-none active:bg-hover"
          >
            <icon-lucide-menu class="size-3.5 text-surface" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            :side-offset="8"
            side="bottom"
            align="end"
            :class="menuContent({ class: 'w-48 rounded-xl p-1.5 shadow-xl' })"
          >
            <DropdownMenuItem
              v-for="item in menuItems"
              :key="item.label"
              :class="
                menuItem({
                  justify: 'start',
                  class:
                    'w-full gap-2.5 rounded-lg border-none bg-transparent px-2.5 py-2 active:bg-hover'
                })
              "
              @click="item.action()"
            >
              <component :is="item.icon" class="size-4 text-muted" />
              <span>{{ item.label }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
  </div>
</template>
