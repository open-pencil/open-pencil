<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import IconChevronDown from '~icons/lucide/chevron-down'

import { menu } from '@/components/ui/menu'
import ToolButton from '@/components/Toolbar/ToolButton.vue'
import { testId as testIdAttr, ToolbarItem } from '@open-pencil/vue'

import type { Tool } from '@open-pencil/vue'
import type { EditorToolDef } from '@open-pencil/core/editor'
import type { ToolbarUi, ToolIconMap, ToolLabels } from '@/components/Toolbar/types'

const {
  tool,
  activeTool,
  toolIcons,
  toolLabels,
  toolShortcuts,
  ui,
  mobile = false
} = defineProps<{
  tool: EditorToolDef
  activeTool: Tool
  toolIcons: ToolIconMap
  toolLabels: ToolLabels
  toolShortcuts: Record<Tool, string>
  ui?: ToolbarUi
  mobile?: boolean
}>()

const emit = defineEmits<{
  select: [tool: Tool]
}>()

defineSlots<{
  default(props: { label: string }): unknown
}>()

function isActiveTool(key: Tool) {
  return (
    tool.key === activeTool || (tool.flyout?.includes(activeTool) ?? false) || key === activeTool
  )
}

function activeKeyForTool() {
  return tool.flyout?.includes(activeTool) ? activeTool : tool.key
}
</script>

<template>
  <div class="flex items-center">
    <slot :label="`${toolLabels[activeKeyForTool()]} (${tool.shortcut})`">
      <ToolButton
        :test-id="`${mobile ? 'mobile-' : ''}toolbar-tool-${activeKeyForTool().toLowerCase()}`"
        :icon="toolIcons[activeKeyForTool()]"
        :active="isActiveTool(activeKeyForTool())"
        :mobile="mobile"
        @click="emit('select', activeKeyForTool())"
      />
    </slot>

    <DropdownMenuRoot>
      <DropdownMenuTrigger as-child>
        <button
          v-bind="testIdAttr(`${mobile ? 'mobile-' : ''}toolbar-flyout-${tool.key.toLowerCase()}`)"
          class="flex h-8 w-3 cursor-pointer items-center justify-center border-none transition-colors"
          :class="[
            mobile ? 'rounded-[6px] select-none' : 'rounded-lg',
            isActiveTool(activeKeyForTool())
              ? 'bg-accent text-white'
              : mobile
                ? 'bg-transparent text-muted active:bg-hover'
                : 'bg-transparent text-muted hover:bg-hover hover:text-surface'
          ]"
        >
          <IconChevronDown class="size-2.5" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuContent side="top" :side-offset="8" align="start" :class="ui?.flyoutContent">
          <ToolbarItem
            v-for="sub in tool.flyout"
            :key="sub"
            v-slot="{ active: subActive, actions }"
            :tool="sub"
          >
            <DropdownMenuItem
              v-bind="testIdAttr(`${mobile ? 'mobile-' : ''}toolbar-flyout-item-${sub.toLowerCase()}`)"
              :class="menu().item({ class: subActive ? 'bg-accent text-white' : undefined })"
              @select="actions.select"
            >
              <component :is="toolIcons[sub]" class="size-3.5" />
              <span class="flex-1">{{ toolLabels[sub] }}</span>
              <span v-if="!mobile && toolShortcuts[sub]" class="text-[11px] text-muted">
                {{ toolShortcuts[sub] }}
              </span>
            </DropdownMenuItem>
          </ToolbarItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>
