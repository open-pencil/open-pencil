<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBreakpoints } from '@vueuse/core'
import { AnimatePresence, motion } from 'motion-v'

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
import type { Tool, ToolDef } from '@/stores/editor'

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

function isActive(tool: ToolDef): boolean {
  if (tool.key === store.state.activeTool) return true
  return tool.flyout?.includes(store.state.activeTool) ?? false
}

function activeKeyForTool(tool: ToolDef): Tool {
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

let toastTimer: ReturnType<typeof setTimeout> | undefined

function onActionTap(item: ActionItem) {
  item.action()
  store.state.actionToast = item.label
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    store.state.actionToast = null
  }, ACTION_TOAST_DURATION)
}

const slideDirection = ref(1)

const slideVariants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 20 }),
  animate: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -20 })
}

function goPrev() {
  if (!hasPrev.value) return
  slideDirection.value = -1
  mobileCategory.value--
}

function goNext() {
  if (!hasNext.value) return
  slideDirection.value = 1
  mobileCategory.value++
}

const toolbarExpanded = ref(false)

interface FlatTool {
  key: Tool
  dividerBefore: boolean
  secondary: boolean
}

// Group 1: navigation — SELECT, HAND
// Group 2: shapes — FRAME, RECTANGLE, ELLIPSE, TEXT  (divider before)
// Expanded extras: SECTION, LINE, POLYGON, STAR, PEN
const FLAT_TOOLS: FlatTool[] = [
  { key: 'SELECT',    dividerBefore: false, secondary: false },
  { key: 'HAND',      dividerBefore: false, secondary: false },
  { key: 'FRAME',     dividerBefore: true,  secondary: false },
  { key: 'SECTION',   dividerBefore: false, secondary: true  },
  { key: 'RECTANGLE', dividerBefore: false, secondary: false },
  { key: 'ELLIPSE',   dividerBefore: false, secondary: false },
  { key: 'LINE',      dividerBefore: false, secondary: true  },
  { key: 'POLYGON',   dividerBefore: false, secondary: true  },
  { key: 'STAR',      dividerBefore: false, secondary: true  },
  { key: 'TEXT',      dividerBefore: false, secondary: false },
  { key: 'PEN',       dividerBefore: true,  secondary: true  },
]

const visibleTools = computed(() =>
  toolbarExpanded.value ? FLAT_TOOLS : FLAT_TOOLS.filter(t => !t.secondary)
)
</script>

<template>
  <!-- Desktop toolbar -->
  <div v-if="!isMobile" class="fixed bottom-5 left-1/2 z-10 -translate-x-1/2">
    <div
      data-test-id="toolbar"
      class="flex items-center gap-0.5 rounded-2xl border border-border/60 bg-panel/95 px-1.5 py-1 shadow-2xl backdrop-blur-sm"
    >
      <template v-for="ft in visibleTools" :key="ft.key">
        <div v-if="ft.dividerBefore" class="mx-1 h-4 w-px shrink-0 rounded-full bg-border/50" />

        <!-- Tool with flyout: circular button + badge caret -->
        <button
          :data-test-id="`toolbar-tool-${ft.key.toLowerCase()}`"
          class="flex cursor-pointer items-center justify-center rounded-full border-none transition-all duration-150"
          :class="[
            'size-7',
            store.state.activeTool === ft.key
              ? 'bg-accent/15 text-accent'
              : 'text-muted hover:bg-white/5 hover:text-surface'
          ]"
          :title="`${toolLabels[ft.key]}${toolShortcuts[ft.key] ? ` (${toolShortcuts[ft.key]})` : ''}`"
          @click="store.setTool(ft.key)"
        >
          <component :is="toolIcons[ft.key]" class="size-[15px]" />
        </button>
      </template>

      <!-- Expand / collapse toggle -->
      <div class="mx-1 h-4 w-px shrink-0 rounded-full bg-border/50" />
      <button
        data-test-id="toolbar-expand"
        class="flex size-6 cursor-pointer items-center justify-center rounded-full text-muted transition-all duration-150 hover:bg-accent/10 hover:text-accent"
        :title="toolbarExpanded ? 'Show less' : 'Show all tools'"
        @click="toolbarExpanded = !toolbarExpanded"
      >
        <IconChevronRight v-if="!toolbarExpanded" class="size-2.5" />
        <IconChevronLeft v-else class="size-2.5" />
      </button>
    </div>
  </div>

  <!-- Mobile toolbar -->
  <div
    v-else
    data-test-id="mobile-toolbar"
    class="fixed left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5"
    :style="{
      maxWidth: 'calc(100vw - 2rem)',
      bottom: `calc(56px + env(safe-area-inset-bottom) + 0.75rem)`
    }"
  >
    <motion.button
      data-test-id="mobile-toolbar-prev"
      class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-panel/95 text-muted shadow-lg backdrop-blur-sm select-none"
      :class="hasPrev ? 'text-muted' : 'pointer-events-none'"
      :animate="{ opacity: hasPrev ? 1 : 0 }"
      :transition="{ duration: 0.15 }"
      @click="goPrev"
    >
      <IconChevronLeft class="size-3.5" />
    </motion.button>

    <motion.div
      layout
      data-test-id="mobile-toolbar-container"
      class="relative flex h-11 items-center overflow-hidden rounded-2xl border border-border/60 bg-panel/95 px-1.5 shadow-2xl backdrop-blur-sm"
      :transition="{ layout: { type: 'spring', damping: 30, stiffness: 500 } }"
    >
      <AnimatePresence mode="popLayout" :custom="slideDirection">
        <motion.div
          v-if="mobileCategory === 0"
          key="tools"
          data-test-id="mobile-toolbar-tools"
          class="flex items-center gap-0.5"
          :variants="slideVariants"
          initial="initial"
          animate="animate"
          exit="exit"
          :transition="{ duration: 0.15 }"
        >
          <template v-for="ft in visibleTools" :key="ft.key">
            <div v-if="ft.dividerBefore" class="mx-0.5 h-4 w-px shrink-0 rounded-full bg-border/50" />
            <button
              :data-test-id="`mobile-toolbar-tool-${ft.key.toLowerCase()}`"
              class="flex cursor-pointer items-center justify-center rounded-full border-none transition-all duration-150 select-none"
              :class="[
                'size-7',
                store.state.activeTool === ft.key
                  ? 'bg-accent/15 text-accent'
                  : 'text-muted active:bg-white/5 active:text-surface'
              ]"
              @click="store.setTool(ft.key)"
            >
              <component :is="toolIcons[ft.key]" class="size-[15px]" />
            </button>
          </template>
          <!-- Expand toggle -->
          <div class="mx-0.5 h-4 w-px shrink-0 rounded-full bg-border/50" />
          <button
            class="flex size-6 cursor-pointer items-center justify-center rounded-full text-muted transition-all duration-150 select-none active:bg-accent/10 active:text-accent"
            @click="toolbarExpanded = !toolbarExpanded"
          >
            <IconChevronRight v-if="!toolbarExpanded" class="size-2.5" />
            <IconChevronLeft v-else class="size-2.5" />
          </button>
        </motion.div>

        <motion.div
          v-else-if="mobileCategory === 1"
          key="edit"
          data-test-id="mobile-toolbar-edit"
          class="flex items-center gap-0.5"
          :variants="slideVariants"
          initial="initial"
          animate="animate"
          exit="exit"
          :transition="{ duration: 0.15 }"
        >
          <button
            v-for="item in editActions"
            :key="item.label"
            :data-test-id="`mobile-toolbar-${item.label.toLowerCase()}`"
            class="flex size-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-muted transition-all duration-150 select-none active:bg-white/5 active:text-surface"
            :title="item.label"
            @click="onActionTap(item)"
          >
            <component :is="item.icon" class="size-[17px]" />
          </button>
        </motion.div>

        <motion.div
          v-else
          key="arrange"
          data-test-id="mobile-toolbar-arrange"
          class="flex items-center gap-0.5"
          :variants="slideVariants"
          initial="initial"
          animate="animate"
          exit="exit"
          :transition="{ duration: 0.15 }"
        >
          <button
            v-for="item in arrangeActions"
            :key="item.label"
            :data-test-id="`mobile-toolbar-${item.label.toLowerCase()}`"
            class="flex size-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-muted transition-all duration-150 select-none active:bg-white/5 active:text-surface"
            :title="item.label"
            @click="onActionTap(item)"
          >
            <component :is="item.icon" class="size-[17px]" />
          </button>
        </motion.div>
      </AnimatePresence>
    </motion.div>

    <motion.button
      data-test-id="mobile-toolbar-next"
      class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-panel/95 text-muted shadow-lg backdrop-blur-sm select-none"
      :class="hasNext ? 'text-muted' : 'pointer-events-none'"
      :animate="{ opacity: hasNext ? 1 : 0 }"
      :transition="{ duration: 0.15 }"
      @click="goNext"
    >
      <IconChevronRight class="size-3.5" />
    </motion.button>
  </div>
</template>
