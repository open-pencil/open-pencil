<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal
} from 'reka-ui'
import { useBreakpoints } from '@vueuse/core'

import IconChevronDown from '~icons/lucide/chevron-down'
import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'
import IconCopy from '~icons/lucide/copy'
import IconClipboard from '~icons/lucide/clipboard'
import IconScissors from '~icons/lucide/scissors'
import IconCopyPlus from '~icons/lucide/copy-plus'
import IconTrash2 from '~icons/lucide/trash-2'
import IconArrowUpToLine from '~icons/lucide/arrow-up-to-line'
import IconArrowDownToLine from '~icons/lucide/arrow-down-to-line'
import IconGroup from '~icons/lucide/group'
import IconUngroup from '~icons/lucide/ungroup'
import IconLock from '~icons/lucide/lock'

import { ACTION_TOAST_DURATION } from '@/constants'
import { TOOLS, useEditorStore } from '@/stores/editor'
import { toolIcons } from '@/utils/tools'

import type { Component } from 'vue'
import type { Tool } from '@/stores/editor'

const store = useEditorStore()
const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')

const toolLabels: Record<Tool, string> = {
  SELECT: 'Move',
  FRAME: 'Frame',
  SECTION: 'Section',
  RECTANGLE: 'Rectangle',
  ELLIPSE: 'Ellipse',
  LINE: 'Line',
  POLYGON: 'Polygon',
  STAR: 'Star',
  PEN: 'Pen',
  TEXT: 'Text',
  HAND: 'Hand'
}

const toolShortcuts: Record<Tool, string> = {
  SELECT: 'V',
  FRAME: 'F',
  SECTION: 'S',
  RECTANGLE: 'R',
  ELLIPSE: 'O',
  LINE: 'L',
  POLYGON: '',
  STAR: '',
  PEN: 'P',
  TEXT: 'T',
  HAND: 'H'
}

function isActive(tool: (typeof TOOLS)[number]): boolean {
  if (tool.key === store.state.activeTool) return true
  return tool.flyout?.includes(store.state.activeTool) ?? false
}

function activeKeyForTool(tool: (typeof TOOLS)[number]): Tool {
  if (tool.flyout?.includes(store.state.activeTool)) return store.state.activeTool
  return tool.key
}

interface ActionItem {
  icon: Component
  label: string
  action: () => void
}

const editActions: ActionItem[] = [
  { icon: IconCopy, label: 'Copy', action: () => store.mobileCopy() },
  { icon: IconClipboard, label: 'Paste', action: () => store.mobilePaste() },
  { icon: IconScissors, label: 'Cut', action: () => store.mobileCut() },
  { icon: IconCopyPlus, label: 'Duplicate', action: () => store.duplicateSelected() },
  { icon: IconTrash2, label: 'Delete', action: () => store.deleteSelected() }
]

const arrangeActions: ActionItem[] = [
  { icon: IconArrowUpToLine, label: 'Front', action: () => store.bringToFront() },
  { icon: IconArrowDownToLine, label: 'Back', action: () => store.sendToBack() },
  { icon: IconGroup, label: 'Group', action: () => store.groupSelected() },
  { icon: IconUngroup, label: 'Ungroup', action: () => store.ungroupSelected() },
  { icon: IconLock, label: 'Lock', action: () => store.toggleLock() }
]

const CATEGORY_COUNT = 3
const mobileCategory = ref(0)
const hasPrev = computed(() => mobileCategory.value > 0)
const hasNext = computed(() => mobileCategory.value < CATEGORY_COUNT - 1)

function prevCategory() {
  if (hasPrev.value) mobileCategory.value--
}
function nextCategory() {
  if (hasNext.value) mobileCategory.value++
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

function onActionTap(item: ActionItem) {
  item.action()
  store.state.actionToast = item.label
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    store.state.actionToast = null
  }, ACTION_TOAST_DURATION)
}

const cat0Ref = ref<HTMLElement | null>(null)
const cat1Ref = ref<HTMLElement | null>(null)
const cat2Ref = ref<HTMLElement | null>(null)
const catRefs = [cat0Ref, cat1Ref, cat2Ref]

const wrapperW = ref(0)
const wrapperH = ref(0)
const measured = ref(false)

function measure() {
  const el = catRefs[mobileCategory.value]?.value
  if (el) {
    wrapperW.value = el.scrollWidth
    wrapperH.value = el.scrollHeight
    measured.value = true
  }
}

onMounted(() => {
  nextTick(measure)
})

watch(mobileCategory, () => {
  nextTick(measure)
})
</script>

<template>
  <div v-if="!isMobile" class="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center">
    <div
      data-test-id="toolbar"
      class="flex gap-0.5 rounded-xl border border-border bg-panel p-1 shadow-lg"
    >
      <template v-for="tool in TOOLS" :key="tool.key">
        <div v-if="tool.flyout && tool.flyout.length > 1" class="flex items-center">
          <button
            :data-test-id="`toolbar-tool-${activeKeyForTool(tool).toLowerCase()}`"
            class="flex size-8 cursor-pointer items-center justify-center rounded-lg border-none transition-colors"
            :class="
              isActive(tool)
                ? 'bg-accent text-white'
                : 'bg-transparent text-muted hover:bg-hover hover:text-surface'
            "
            :title="`${toolLabels[activeKeyForTool(tool)]} (${tool.shortcut})`"
            @click="store.setTool(activeKeyForTool(tool))"
          >
            <component :is="toolIcons[activeKeyForTool(tool)]" class="size-4" />
          </button>

          <DropdownMenuRoot>
            <DropdownMenuTrigger as-child>
              <button
                :data-test-id="`toolbar-flyout-${tool.key.toLowerCase()}`"
                class="flex h-8 w-3 cursor-pointer items-center justify-center rounded-lg border-none transition-colors"
                :class="
                  isActive(tool)
                    ? 'bg-accent text-white'
                    : 'bg-transparent text-muted hover:bg-hover hover:text-surface'
                "
              >
                <IconChevronDown class="size-2.5" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuPortal>
              <DropdownMenuContent
                side="top"
                :side-offset="8"
                align="start"
                class="min-w-32 rounded-lg border border-border bg-panel p-1 shadow-lg"
              >
                <DropdownMenuItem
                  v-for="sub in tool.flyout"
                  :key="sub"
                  :data-test-id="`toolbar-flyout-item-${sub.toLowerCase()}`"
                  class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none transition-colors"
                  :class="
                    store.state.activeTool === sub
                      ? 'bg-accent text-white'
                      : 'text-surface hover:bg-hover'
                  "
                  @select="store.setTool(sub)"
                >
                  <component :is="toolIcons[sub]" class="size-3.5" />
                  <span class="flex-1">{{ toolLabels[sub] }}</span>
                  <span v-if="toolShortcuts[sub]" class="text-[11px] text-muted">{{
                    toolShortcuts[sub]
                  }}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </div>

        <button
          v-else
          :data-test-id="`toolbar-tool-${tool.key.toLowerCase()}`"
          class="flex size-8 cursor-pointer items-center justify-center rounded-lg border-none transition-colors"
          :class="
            isActive(tool)
              ? 'bg-accent text-white'
              : 'bg-transparent text-muted hover:bg-hover hover:text-surface'
          "
          :title="`${toolLabels[tool.key]} (${tool.shortcut})`"
          @click="store.setTool(tool.key)"
        >
          <component :is="toolIcons[tool.key]" class="size-4" />
        </button>
      </template>
    </div>
  </div>

  <!-- Mobile toolbar -->
  <div
    v-else
    data-test-id="mobile-toolbar"
    class="fixed inset-x-0 z-20 flex items-center justify-center gap-1.5 px-2"
    :style="{ bottom: `calc(44px + env(safe-area-inset-bottom) + 0.75rem)` }"
    @touchstart.stop
  >
    <button
      data-test-id="mobile-toolbar-prev"
      class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-panel shadow-sm transition-opacity select-none"
      :class="hasPrev ? 'text-muted opacity-100' : 'pointer-events-none opacity-0'"
      @click="prevCategory"
    >
      <IconChevronLeft class="size-3.5" />
    </button>

    <div
      data-test-id="mobile-toolbar-container"
      class="relative flex h-11 items-center overflow-hidden rounded-[8px] border border-border bg-panel px-2 shadow-lg"
      :style="measured ? { width: wrapperW + 16 + 'px', transition: 'width 250ms ease' } : {}"
    >
      <div
        ref="cat0Ref"
        data-test-id="mobile-toolbar-tools"
        class="flex gap-0.5 transition-opacity duration-200"
        :class="
          mobileCategory === 0
            ? 'relative opacity-100'
            : 'absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0'
        "
      >
        <template v-for="tool in TOOLS" :key="tool.key">
          <div v-if="tool.flyout && tool.flyout.length > 1" class="flex items-center">
            <button
              :data-test-id="`mobile-toolbar-tool-${activeKeyForTool(tool).toLowerCase()}`"
              class="flex size-8 cursor-pointer items-center justify-center rounded-[6px] border-none transition-colors select-none"
              :class="
                isActive(tool)
                  ? 'bg-accent text-white'
                  : 'bg-transparent text-muted active:bg-hover'
              "
              @click="store.setTool(activeKeyForTool(tool))"
            >
              <component :is="toolIcons[activeKeyForTool(tool)]" class="size-4" />
            </button>

            <DropdownMenuRoot>
              <DropdownMenuTrigger as-child>
                <button
                  :data-test-id="`mobile-toolbar-flyout-${tool.key.toLowerCase()}`"
                  class="flex h-8 w-3 cursor-pointer items-center justify-center rounded-[6px] border-none transition-colors select-none"
                  :class="
                    isActive(tool)
                      ? 'bg-accent text-white'
                      : 'bg-transparent text-muted active:bg-hover'
                  "
                >
                  <IconChevronDown class="size-2.5" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuPortal>
                <DropdownMenuContent
                  side="top"
                  :side-offset="8"
                  align="start"
                  class="min-w-32 rounded-lg border border-border bg-panel p-1 shadow-lg"
                >
                  <DropdownMenuItem
                    v-for="sub in tool.flyout"
                    :key="sub"
                    :data-test-id="`mobile-toolbar-flyout-item-${sub.toLowerCase()}`"
                    class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none transition-colors"
                    :class="
                      store.state.activeTool === sub
                        ? 'bg-accent text-white'
                        : 'text-surface hover:bg-hover'
                    "
                    @select="store.setTool(sub)"
                  >
                    <component :is="toolIcons[sub]" class="size-3.5" />
                    <span class="flex-1">{{ toolLabels[sub] }}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenuRoot>
          </div>

          <button
            v-else
            :data-test-id="`mobile-toolbar-tool-${tool.key.toLowerCase()}`"
            class="flex size-8 cursor-pointer items-center justify-center rounded-[6px] border-none transition-colors select-none"
            :class="
              isActive(tool) ? 'bg-accent text-white' : 'bg-transparent text-muted active:bg-hover'
            "
            @click="store.setTool(tool.key)"
          >
            <component :is="toolIcons[tool.key]" class="size-4" />
          </button>
        </template>
      </div>

      <div
        ref="cat1Ref"
        data-test-id="mobile-toolbar-edit"
        class="flex gap-0.5 transition-opacity duration-200"
        :class="
          mobileCategory === 1
            ? 'relative opacity-100'
            : 'absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0'
        "
      >
        <button
          v-for="item in editActions"
          :key="item.label"
          :data-test-id="`mobile-toolbar-${item.label.toLowerCase()}`"
          class="flex size-8 cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent text-muted transition-colors select-none active:bg-hover active:text-surface"
          @click="onActionTap(item)"
        >
          <component :is="item.icon" class="size-4" />
        </button>
      </div>

      <div
        ref="cat2Ref"
        data-test-id="mobile-toolbar-arrange"
        class="flex gap-0.5 transition-opacity duration-200"
        :class="
          mobileCategory === 2
            ? 'relative opacity-100'
            : 'absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-0'
        "
      >
        <button
          v-for="item in arrangeActions"
          :key="item.label"
          :data-test-id="`mobile-toolbar-${item.label.toLowerCase()}`"
          class="flex size-8 cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent text-muted transition-colors select-none active:bg-hover active:text-surface"
          @click="onActionTap(item)"
        >
          <component :is="item.icon" class="size-4" />
        </button>
      </div>
    </div>

    <button
      data-test-id="mobile-toolbar-next"
      class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-panel shadow-sm transition-opacity select-none"
      :class="hasNext ? 'text-muted opacity-100' : 'pointer-events-none opacity-0'"
      @click="nextCategory"
    >
      <IconChevronRight class="size-3.5" />
    </button>
  </div>
</template>
