<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { MIXED } from '@open-pencil/vue/controls/node-props'
import type { VariableModeChoice } from '@open-pencil/vue/controls/variable-modes'
import { usePanelMessages } from '@open-pencil/vue/i18n'

import IconButton from '@/components/ui/button/IconButton.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'

import { AUTO_MODE, autoModeLabel } from './labels'

/** Figma's Apply variable mode button: a collection, then Auto or one of its modes. */
const { choices } = defineProps<{ choices: VariableModeChoice[] }>()
const emit = defineEmits<{ set: [collectionId: string, modeId: string | null] }>()

const panels = usePanelMessages()
const menu = useMenuUI({ content: 'min-w-44' })
const item = menuItem({ justify: 'start', class: 'pl-6 relative' })
const groups = computed(() =>
  [
    { label: panels.value.variableModesInFile, choices: choices.filter((c) => !c.library) },
    { label: panels.value.variableModesFromLibraries, choices: choices.filter((c) => c.library) }
  ].filter((group) => group.choices.length > 0)
)

/** The radio value a choice shows: its mode, Auto, or none checked when the targets differ. */
function current(choice: VariableModeChoice): string {
  if (choice.value === MIXED) return ''
  return choice.value ?? AUTO_MODE
}

function select(choice: VariableModeChoice, value: string) {
  emit('set', choice.collectionId, value === AUTO_MODE ? null : value)
}
</script>

<template>
  <DropdownMenuRoot v-if="choices.length > 0">
    <DropdownMenuTrigger as-child>
      <IconButton :label="panels.applyVariableMode" data-variable-mode-menu>
        <icon-lucide-swatch-book class="size-3.5" />
      </IconButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent side="bottom" align="end" :side-offset="4" :class="menu.content">
        <MenuScrollArea>
          <template v-for="(group, index) in groups" :key="group.label">
            <DropdownMenuSeparator v-if="index > 0" :class="menu.separator" />
            <DropdownMenuLabel :class="menu.label">{{ group.label }}</DropdownMenuLabel>
            <DropdownMenuSub v-for="choice in group.choices" :key="choice.collectionId">
              <DropdownMenuSubTrigger
                :class="[menu.subTrigger, 'justify-between data-[highlighted]:bg-hover']"
              >
                {{ choice.name }}
                <icon-lucide-chevron-right :class="menu.icon" />
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent :side-offset="4" :class="menu.content">
                  <MenuScrollArea>
                    <DropdownMenuRadioGroup
                      :model-value="current(choice)"
                      @update:model-value="
                        (value) => typeof value === 'string' && select(choice, value)
                      "
                    >
                      <DropdownMenuRadioItem :value="AUTO_MODE" :class="item">
                        <DropdownMenuItemIndicator class="absolute left-1.5">
                          <icon-lucide-check :class="menu.icon" />
                        </DropdownMenuItemIndicator>
                        {{ autoModeLabel(panels, choice) }}
                      </DropdownMenuRadioItem>
                      <DropdownMenuSeparator :class="menu.separator" />
                      <DropdownMenuLabel :class="menu.label">
                        {{ panels.variableModeHeading }}
                      </DropdownMenuLabel>
                      <DropdownMenuRadioItem
                        v-for="mode in choice.modes"
                        :key="mode.modeId"
                        :value="mode.modeId"
                        :class="item"
                      >
                        <DropdownMenuItemIndicator class="absolute left-1.5">
                          <icon-lucide-check :class="menu.icon" />
                        </DropdownMenuItemIndicator>
                        {{ mode.name }}
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </MenuScrollArea>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </template>
        </MenuScrollArea>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
