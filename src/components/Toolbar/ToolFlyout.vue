<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import IconChevronDown from '~icons/lucide/chevron-down'

import AppShortcutText from '@/components/ui/AppShortcutText.vue'
import { menu } from '@/components/ui/menu'
import toolbarTheme from '@/theme/toolbar'
import ToolButton from '@/components/Toolbar/ToolButton.vue'
import {
  isToolbarToolActive,
  toolbarFlyoutItemTestId,
  toolbarFlyoutTestId,
  toolbarToolTestId,
  vTestId
} from '@open-pencil/vue'

import type { Tool } from '@open-pencil/vue'
import type { EditorToolDef } from '@open-pencil/core/editor'
import type { ToolbarUI, ToolIconMap, ToolLabels } from '@/components/Toolbar/types'

const {
  tool,
  activeTool,
  selectedTool,
  toolIcons,
  toolLabels,
  toolShortcuts,
  ui,
  mobile = false
} = defineProps<{
  tool: EditorToolDef
  activeTool: Tool
  selectedTool: Tool
  toolIcons: ToolIconMap
  toolLabels: ToolLabels
  toolShortcuts: Record<Tool, string>
  ui?: ToolbarUI
  mobile?: boolean
}>()

const toolbar = tv(toolbarTheme)
const triggerActive = computed(() => isToolbarToolActive(tool, activeTool))
const styles = computed(() => toolbar({ active: triggerActive.value, mobile }))

const emit = defineEmits<{
  select: [tool: Tool]
}>()

defineSlots<{
  default(props: { label: string }): unknown
}>()

function flyoutItemClass() {
  return menu({ justify: 'start' }).item({
    class: toolbar().flyoutItem({ class: ui?.flyoutItem })
  })
}
</script>

<template>
  <div :class="styles.flyoutGroup({ class: ui?.flyoutGroup })">
    <slot :label="`${toolLabels[selectedTool]} (${tool.shortcut})`">
      <ToolButton
        :data-test-id="toolbarToolTestId(selectedTool, mobile)"
        :icon="toolIcons[selectedTool]"
        :label="toolLabels[selectedTool]"
        :active="triggerActive"
        :mobile="mobile"
        :ui="ui"
        @click="emit('select', selectedTool)"
      />
    </slot>

    <DropdownMenuRoot>
      <DropdownMenuTrigger as-child>
        <button
          v-test-id="toolbarFlyoutTestId(tool.key, mobile)"
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
          <DropdownMenuRadioGroup :model-value="selectedTool">
            <DropdownMenuRadioItem
              v-for="sub in tool.flyout"
              :key="sub"
              v-test-id="toolbarFlyoutItemTestId(sub, mobile)"
              :value="sub"
              :data-active="sub === selectedTool || undefined"
              :class="flyoutItemClass()"
              @select="emit('select', sub)"
            >
              <span
                data-slot="flyout-item-indicator"
                :class="styles.flyoutItemIndicator({ class: ui?.flyoutItemIndicator })"
                aria-hidden="true"
              >
                <DropdownMenuItemIndicator>
                  <icon-lucide-check class="size-3.5" />
                </DropdownMenuItemIndicator>
              </span>
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
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>
