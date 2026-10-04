<script setup lang="ts">
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { useDesignCheckMessages } from '@open-pencil/vue'

import {
  setDesignCheckPreset,
  setDesignIssuesOnCanvas,
  turnOnDesignCheckRules
} from '@/app/settings/preferences/apply'
import { appPreferences, DESIGN_CHECK_PRESETS } from '@/app/settings/preferences/store'
import IconButton from '@/components/ui/button/IconButton.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'

import { usePresetLabels } from './usePresetLabels'

const messages = useDesignCheckMessages()
const presetLabels = usePresetLabels()
const menuCls = useMenuUI({ content: 'min-w-56' })
const itemCls = menuItem({ justify: 'start', class: 'relative pl-7' })
const preferences = computed(() => appPreferences.value.designCheck)

const presetModel = computed({
  get: () => preferences.value.preset,
  set: (value: string) => {
    const preset = DESIGN_CHECK_PRESETS.find((candidate) => candidate === value)
    if (preset) setDesignCheckPreset(preset)
  }
})
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger as-child>
      <IconButton size="xs" :label="messages.rules">
        <icon-lucide-settings-2 class="size-3.5" />
      </IconButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent side="bottom" align="end" :side-offset="4" :class="menuCls.content">
        <DropdownMenuLabel :class="menuCls.label">{{ messages.rules }}</DropdownMenuLabel>
        <DropdownMenuRadioGroup v-model="presetModel">
          <DropdownMenuRadioItem
            v-for="preset in DESIGN_CHECK_PRESETS"
            :key="preset"
            :value="preset"
            :class="itemCls"
          >
            <DropdownMenuItemIndicator class="absolute left-2">
              <icon-lucide-check class="size-3.5" />
            </DropdownMenuItemIndicator>
            {{ presetLabels[preset] }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <template v-if="preferences.disabledRules.length > 0">
          <DropdownMenuSeparator :class="menuCls.separator" />
          <DropdownMenuItem :class="itemCls" @select="turnOnDesignCheckRules">
            {{ messages.turnOnRules({ count: preferences.disabledRules.length }) }}
          </DropdownMenuItem>
        </template>
        <DropdownMenuSeparator :class="menuCls.separator" />
        <DropdownMenuCheckboxItem
          :model-value="preferences.showOnCanvas"
          :class="itemCls"
          @update:model-value="setDesignIssuesOnCanvas"
        >
          <DropdownMenuItemIndicator class="absolute left-2">
            <icon-lucide-check class="size-3.5" />
          </DropdownMenuItemIndicator>
          {{ messages.showOnCanvas }}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
