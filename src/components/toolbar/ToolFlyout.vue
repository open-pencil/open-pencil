<script setup lang="ts">
import {
  ToolbarButton,
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'
import IconChevronDown from '~icons/lucide/chevron-down'

import type { EditorToolDef, Tool } from '@open-pencil/core'
import { useI18n } from '@open-pencil/vue/i18n'
import { isToolbarToolActive } from '@open-pencil/vue/primitives/Toolbar'
import {
  toolbarFlyoutItemTestId,
  toolbarFlyoutTestId,
  toolbarToolTestId,
  vTestId
} from '@open-pencil/vue/testing'

import { toolTip } from '@/app/editor/toolbar/shortcuts'
import ToolButton from '@/components/toolbar/ToolButton.vue'
import type { ToolbarUI, ToolIconMap, ToolLabels } from '@/components/toolbar/types'
import AppShortcutText from '@/components/ui/menu/AppShortcutText.vue'
import { menu } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'
import toolbarTheme from '@/theme/toolbar'

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
  toolShortcuts: Readonly<Record<Tool, string>>
  ui?: ToolbarUI
  mobile?: boolean
}>()

const toolbar = tv(toolbarTheme)
const { editor } = useI18n()
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
    <slot :label="toolTip(toolLabels[selectedTool], toolShortcuts[selectedTool])">
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
        <ToolbarButton
          v-test-id="toolbarFlyoutTestId(tool.key, mobile)"
          :data-mobile="mobile || undefined"
          :aria-label="editor.toolOptions({ tool: toolLabels[tool.key] })"
          :class="styles.flyoutTrigger({ class: ui?.flyoutTrigger })"
        >
          <IconChevronDown :class="styles.flyoutTriggerIcon({ class: ui?.flyoutTriggerIcon })" />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuContent
          side="top"
          :side-offset="8"
          align="start"
          :class="styles.flyoutContent({ class: ui?.flyoutContent })"
        >
          <MenuScrollArea>
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
          </MenuScrollArea>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>
