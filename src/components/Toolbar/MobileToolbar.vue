<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { AnimatePresence, motion } from 'motion-v'

import IconChevronLeft from '~icons/lucide/chevron-left'
import IconChevronRight from '~icons/lucide/chevron-right'

import ToolButton from '@/components/Toolbar/ToolButton.vue'
import ToolFlyout from '@/components/Toolbar/ToolFlyout.vue'
import ToolbarActionGroup from '@/components/Toolbar/ToolbarActionGroup.vue'
import toolbarTheme from '@/theme/toolbar'
import { getToolbarToolSelection, toolbarToolTestId, ToolbarItem } from '@open-pencil/vue'

import type { Tool } from '@open-pencil/vue'
import type { EditorToolDef } from '@open-pencil/core/editor'
import type {
  ToolbarActionItem,
  ToolbarUI,
  ToolIconMap,
  ToolLabels
} from '@/components/Toolbar/types'

const {
  tools,
  activeTool,
  flyoutSelections,
  toolIcons,
  toolLabels,
  toolShortcuts,
  ui,
  mobileCategory,
  slideDirection,
  hasPrev,
  hasNext,
  editActions,
  arrangeActions
} = defineProps<{
  tools: EditorToolDef[]
  activeTool: Tool
  flyoutSelections: ReadonlyMap<Tool, Tool>
  toolIcons: ToolIconMap
  toolLabels: ToolLabels
  toolShortcuts: Record<Tool, string>
  ui?: ToolbarUI
  mobileCategory: number
  slideDirection: number
  hasPrev: boolean
  hasNext: boolean
  editActions: ToolbarActionItem[]
  arrangeActions: ToolbarActionItem[]
}>()

const toolbar = tv(toolbarTheme)
const styles = toolbar()

const emit = defineEmits<{
  setTool: [tool: Tool]
  prev: []
  next: []
  action: [item: ToolbarActionItem]
}>()

const slideVariants = {
  initial: (dir: unknown) => ({ opacity: 0, x: (dir as number) * 20 }),
  animate: { opacity: 1, x: 0 },
  exit: (dir: unknown) => ({ opacity: 0, x: (dir as number) * -20 })
}

function navigationClass(disabled: boolean) {
  return toolbar({ disabled }).navigationAction({ class: ui?.navigationAction })
}
</script>

<template>
  <div
    data-test-id="mobile-toolbar"
    class="fixed left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5"
    :style="{
      maxWidth: 'calc(100vw - 2rem)',
      bottom: `calc(56px + env(safe-area-inset-bottom) + 0.75rem)`
    }"
  >
    <motion.button
      data-test-id="mobile-toolbar-prev"
      :disabled="!hasPrev"
      :data-disabled="!hasPrev || undefined"
      :class="navigationClass(!hasPrev)"
      :animate="{ opacity: hasPrev ? 1 : 0 }"
      :transition="{ duration: 0.15 }"
      @click="emit('prev')"
    >
      <IconChevronLeft :class="styles.navigationIcon({ class: ui?.navigationIcon })" />
    </motion.button>

    <motion.div
      layout
      data-test-id="mobile-toolbar-container"
      class="relative flex h-11 items-center overflow-hidden rounded-[8px] border border-border bg-panel px-2 shadow-lg"
      :transition="{ layout: { type: 'spring', damping: 30, stiffness: 500 } }"
    >
      <AnimatePresence mode="popLayout" :custom="slideDirection">
        <motion.div
          v-if="mobileCategory === 0"
          key="tools"
          data-test-id="mobile-toolbar-tools"
          class="flex gap-0.5"
          :variants="slideVariants"
          initial="initial"
          animate="animate"
          exit="exit"
          :transition="{ duration: 0.15 }"
        >
          <template v-for="tool in tools" :key="tool.key">
            <ToolFlyout
              v-if="tool.flyout && tool.flyout.length > 1"
              mobile
              :tool="tool"
              :active-tool="activeTool"
              :selected-tool="getToolbarToolSelection(tool, activeTool, flyoutSelections)"
              :tool-icons="toolIcons"
              :tool-labels="toolLabels"
              :tool-shortcuts="toolShortcuts"
              :ui="ui"
              @select="emit('setTool', $event)"
            />

            <ToolbarItem v-else v-slot="{ active, actions }" :tool="tool.key">
              <ToolButton
                mobile
                :data-test-id="toolbarToolTestId(tool.key, true)"
                :icon="toolIcons[tool.key]"
                :active="
                  active ||
                  getToolbarToolSelection(tool, activeTool, flyoutSelections) === activeTool
                "
                :ui="ui"
                @click="actions.select"
              />
            </ToolbarItem>
          </template>
        </motion.div>

        <motion.div
          v-else-if="mobileCategory === 1"
          key="edit"
          data-test-id="mobile-toolbar-edit"
          class="flex gap-0.5"
          :variants="slideVariants"
          initial="initial"
          animate="animate"
          exit="exit"
          :transition="{ duration: 0.15 }"
        >
          <ToolbarActionGroup
            :actions="editActions"
            :ui="ui"
            test-prefix="mobile-toolbar"
            @action="emit('action', $event)"
          />
        </motion.div>

        <motion.div
          v-else
          key="arrange"
          data-test-id="mobile-toolbar-arrange"
          class="flex gap-0.5"
          :variants="slideVariants"
          initial="initial"
          animate="animate"
          exit="exit"
          :transition="{ duration: 0.15 }"
        >
          <ToolbarActionGroup
            :actions="arrangeActions"
            :ui="ui"
            test-prefix="mobile-toolbar"
            @action="emit('action', $event)"
          />
        </motion.div>
      </AnimatePresence>
    </motion.div>

    <motion.button
      data-test-id="mobile-toolbar-next"
      :disabled="!hasNext"
      :data-disabled="!hasNext || undefined"
      :class="navigationClass(!hasNext)"
      :animate="{ opacity: hasNext ? 1 : 0 }"
      :transition="{ duration: 0.15 }"
      @click="emit('next')"
    >
      <IconChevronRight :class="styles.navigationIcon({ class: ui?.navigationIcon })" />
    </motion.button>
  </div>
</template>
