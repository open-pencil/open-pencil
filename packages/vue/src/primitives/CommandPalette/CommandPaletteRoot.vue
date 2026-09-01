<script setup lang="ts">
import { provide, toRef } from 'vue'
import {
  ListboxContent,
  ListboxFilter,
  ListboxGroup,
  ListboxGroupLabel,
  ListboxItem,
  ListboxRoot
} from 'reka-ui'

import { COMMAND_PALETTE_KEY } from './context'
import { useCommandPalette } from './useCommandPalette'
import type {
  CommandPaletteGroup,
  CommandPaletteItem,
  CommandPaletteLabels,
  CommandPaletteUI
} from './types'

const {
  groups,
  labels,
  ui,
  placeholder,
  resultLimit = 12
} = defineProps<{
  groups: CommandPaletteGroup[]
  labels: CommandPaletteLabels
  ui?: CommandPaletteUI
  placeholder?: string
  resultLimit?: number
}>()

const emit = defineEmits<{ select: [item: CommandPaletteItem] }>()
const palette = useCommandPalette(() => ({ groups, resultLimit }))

provide(COMMAND_PALETTE_KEY, {
  groups: toRef(() => groups),
  searchTerm: palette.searchTerm,
  isNested: palette.isNested,
  labels: toRef(() => labels),
  ui: toRef(() => ui),
  navigate: palette.navigate,
  navigateBack: palette.navigateBack,
  select: palette.select
})

function select(item: CommandPaletteItem) {
  palette.select(item)
  emit('select', item)
}
</script>

<template>
  <ListboxRoot
    v-model="palette.selectedId.value"
    :class="ui?.root"
    :aria-label="labels.paletteLabel"
    :data-searching="palette.searchTerm.value ? '' : undefined"
  >
    <div v-if="palette.isNested.value" :class="ui?.back">
      <button type="button" @click="palette.navigateBack()">{{ labels.back }}</button>
    </div>
    <div :class="ui?.searchWrapper">
      <slot name="search-leading" />
      <ListboxFilter v-model="palette.searchTerm.value" as-child>
        <input
          type="search"
          :value="palette.searchTerm.value"
          :placeholder="placeholder ?? labels.searchPlaceholder"
          :aria-label="labels.searchLabel"
          :class="ui?.search"
          autocomplete="off"
          @keydown.backspace="palette.searchTerm.value || palette.navigateBack()"
        />
      </ListboxFilter>
      <slot name="search-trailing" />
    </div>
    <ListboxContent :class="ui?.content">
      <template v-if="palette.filteredGroups.value.length">
        <ListboxGroup
          v-for="group in palette.filteredGroups.value"
          :key="group.id"
          :class="ui?.group"
        >
          <ListboxGroupLabel v-if="group.label" :class="ui?.label">{{
            group.label
          }}</ListboxGroupLabel>
          <ListboxItem
            v-for="item in group.items"
            :key="item.id"
            :value="item.id"
            :disabled="item.disabled"
            :class="ui?.item"
            @select="select(item)"
          >
            <span :class="ui?.itemIcon"><slot name="item-icon" :item="item" /></span>
            <span :class="ui?.itemLabel">{{ item.label }}</span>
            <span v-if="item.description" :class="ui?.itemDescription">{{ item.description }}</span>
            <span v-if="item.shortcut" :class="ui?.shortcut">
              <kbd v-for="key in item.shortcut.keys" :key="key" :class="ui?.key">{{ key }}</kbd>
            </span>
          </ListboxItem>
        </ListboxGroup>
      </template>
      <slot v-else name="empty" :search-term="palette.searchTerm.value">{{ labels.empty }}</slot>
    </ListboxContent>
  </ListboxRoot>
</template>
