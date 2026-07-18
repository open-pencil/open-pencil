<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import IconChevronDown from '~icons/lucide/chevron-down'

import AppShortcutText from '@/components/ui/AppShortcutText.vue'
import { menu } from '@/components/ui/menu'
import toolbarTheme from '@/theme/toolbar'
import ToolButton from '@/components/Toolbar/ToolButton.vue'
import {
  toolbarFlyoutItemTestId,
  toolbarFlyoutTestId,
  toolbarToolTestId,
  vTestId,
  ToolbarItem
} from '@open-pencil/vue'

import type { Tool } from '@open-pencil/vue'
import type { EditorToolDef } from '@open-pencil/core/editor'
import type { ToolbarUI, ToolIconMap, ToolLabels } from '@/components/Toolbar/types'

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
  ui?: ToolbarUI
  mobile?: boolean
}>()

const toolbar = tv(toolbarTheme)
const triggerActive = computed(() => isActiveTool(activeKeyForTool()))
const styles = computed(() => toolbar({ active: triggerActive.value, mobile }))

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

function flyoutItemClass(subActive: boolean) {
  return menu().item({ class: toolbar({ subActive }).flyoutItem({ class: ui?.flyoutItem }) })
}
</script>

<template>
  <div :class="styles.flyoutGroup({ class: ui?.flyoutGroup })">
    <slot :label="`${toolLabels[activeKeyForTool()]} (${tool.shortcut})`">
      <ToolButton
        :data-test-id="toolbarToolTestId(activeKeyForTool(), mobile)"
        :icon="toolIcons[activeKeyForTool()]"
        :label="toolLabels[activeKeyForTool()]"
        :active="triggerActive"
        :mobile="mobile"
        :ui="ui"
        @click="emit('select', activeKeyForTool())"
      />
    </slot>

    <DropdownMenuRoot>
      <DropdownMenuTrigger as-child>
        <button
          v-test-id="toolbarFlyoutTestId(tool.key, mobile)"
          :data-active="triggerActive || undefined"
          :data-mobile="mobile || undefined"
          :aria-label="`${toolLabels[tool.key]} options`"
          :class="styles.flyoutTrigger({ class: ui?.flyoutTrigger })"
        >
          <IconChevronDown :class="styles.flyoutTriggerIcon({ class: ui?.flyoutTriggerIcon })" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuContent
          side="top"
          :side-offset="8"
          align="start"
          :class="styles.flyoutContent({ class: ui?.flyoutContent })"
        >
          <ToolbarItem
            v-for="sub in tool.flyout"
            :key="sub"
            v-slot="{ active: subActive, actions }"
            :tool="sub"
          >
            <DropdownMenuItem
              v-test-id="toolbarFlyoutItemTestId(sub, mobile)"
              :data-active="subActive || undefined"
              :class="flyoutItemClass(subActive)"
              @select="actions.select"
            >
              <component
                :is="toolIcons[sub]"
                :class="styles.flyoutItemIcon({ class: ui?.flyoutItemIcon })"
              />
              <span :class="styles.flyoutItemLabel({ class: ui?.flyoutItemLabel })">
                {{ toolLabels[sub] }}
              </span>
              <AppShortcutText v-if="!mobile && toolShortcuts[sub]">
                {{ toolShortcuts[sub] }}
              </AppShortcutText>
            </DropdownMenuItem>
          </ToolbarItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>
