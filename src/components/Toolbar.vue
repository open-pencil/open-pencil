<script setup lang="ts">
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal
} from 'reka-ui'

import IconMousePointer from '~icons/lucide/mouse-pointer'
import IconFrame from '~icons/lucide/frame'
import IconLayoutGrid from '~icons/lucide/layout-grid'
import IconSquare from '~icons/lucide/square'
import IconCircle from '~icons/lucide/circle'
import IconMinus from '~icons/lucide/minus'
import IconTriangle from '~icons/lucide/triangle'
import IconStar from '~icons/lucide/star'
import IconPenTool from '~icons/lucide/pen-tool'
import IconType from '~icons/lucide/type'
import IconHand from '~icons/lucide/hand'
import IconChevronDown from '~icons/lucide/chevron-down'

import { TOOLS, useEditorStore } from '@/stores/editor'

import type { Tool } from '@/stores/editor'

const store = useEditorStore()

const toolIcons: Record<Tool, typeof IconSquare> = {
  SELECT: IconMousePointer,
  FRAME: IconFrame,
  SECTION: IconLayoutGrid,
  RECTANGLE: IconSquare,
  ELLIPSE: IconCircle,
  LINE: IconMinus,
  POLYGON: IconTriangle,
  STAR: IconStar,
  PEN: IconPenTool,
  TEXT: IconType,
  HAND: IconHand
}

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
</script>

<template>
  <div class="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center">
    <div
      data-test-id="toolbar"
      class="flex gap-0.5 rounded-xl border border-border bg-panel p-1 shadow-lg"
    >
      <template v-for="tool in TOOLS" :key="tool.key">
        <!-- Tool with flyout: split button + chevron -->
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

        <!-- Simple tool button -->
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
</template>
