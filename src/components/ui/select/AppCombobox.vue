<script setup lang="ts">
import Fuse from 'fuse.js'
import { computed, ref } from 'vue'
import { tv } from 'tailwind-variants'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxLabel,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
  type AcceptableValue
} from 'reka-ui'

import theme from '@/theme/select/combobox'
import type { AppComboboxTheme } from '@/theme/select/combobox'
import type { ComponentUI } from '@/components/ui/types'

export type AppComboboxOption = {
  value: string
  label: string
  description?: string
  meta?: string
  group?: string
  disabled?: boolean
}

interface AppComboboxProps {
  options: AppComboboxOption[]
  label?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  disabled?: boolean
  resultLimit?: number
  ui?: ComponentUI<AppComboboxTheme>
}

defineOptions({ inheritAttrs: false })

const {
  options,
  label,
  placeholder,
  searchPlaceholder,
  emptyLabel = 'No results',
  disabled = false,
  resultLimit = 100,
  ui
} = defineProps<AppComboboxProps>()

const modelValue = defineModel<string>({ required: true })
const open = ref(false)
const searchTerm = ref('')
const styles = tv(theme)()

const selectedOption = computed(() => options.find((option) => option.value === modelValue.value))
const searchIndex = computed(
  () =>
    new Fuse(options, {
      keys: ['label', 'value', 'description', 'meta'],
      threshold: 0.2,
      ignoreLocation: true
    })
)
const filteredOptions = computed(() => {
  const query = searchTerm.value.trim()
  if (!query) return options.slice(0, resultLimit)
  return searchIndex.value
    .search(query)
    .slice(0, resultLimit)
    .map((result) => result.item)
})
const groupedOptions = computed(() => {
  const groups = new Map<string, AppComboboxOption[]>()
  for (const option of filteredOptions.value) {
    const group = option.group ?? ''
    const entries = groups.get(group)
    if (entries) entries.push(option)
    else groups.set(group, [option])
  }
  return [...groups.entries()]
})

function updateValue(value: AcceptableValue): void {
  if (typeof value !== 'string') return
  modelValue.value = value
}

function updateOpen(value: boolean): void {
  open.value = value
  if (!value) searchTerm.value = ''
}
</script>

<template>
  <ComboboxRoot
    :model-value="modelValue"
    :open="open"
    :disabled="disabled"
    :ignore-filter="true"
    @update:model-value="updateValue"
    @update:open="updateOpen"
  >
    <ComboboxAnchor as-child>
      <ComboboxTrigger
        v-bind="$attrs"
        :aria-label="label"
        :class="styles.trigger({ class: ui?.trigger })"
      >
        <slot name="value" :option="selectedOption">
          <span :class="styles.value({ class: ui?.value })">
            {{ selectedOption?.label ?? (modelValue || placeholder) }}
          </span>
        </slot>
        <icon-lucide-chevron-down :class="styles.chevron({ class: ui?.chevron })" />
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        :side-offset="2"
        :class="styles.content({ class: ui?.content })"
      >
        <div :class="styles.search({ class: ui?.search })">
          <icon-lucide-search :class="styles.searchIcon({ class: ui?.searchIcon })" />
          <ComboboxInput
            v-model="searchTerm"
            :aria-label="searchPlaceholder ?? label"
            :placeholder="searchPlaceholder"
            :display-value="() => ''"
            :class="styles.input({ class: ui?.input })"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
        </div>

        <ComboboxViewport :class="styles.viewport({ class: ui?.viewport })">
          <ComboboxEmpty :class="styles.empty({ class: ui?.empty })">
            <slot name="empty" :query="searchTerm">
              {{ emptyLabel }}
            </slot>
          </ComboboxEmpty>
          <ComboboxGroup v-for="([group, entries], index) in groupedOptions" :key="group || index">
            <ComboboxLabel v-if="group" :class="styles.groupLabel({ class: ui?.groupLabel })">
              <slot name="group-label" :group="group">
                {{ group }}
              </slot>
            </ComboboxLabel>
            <ComboboxItem
              v-for="option in entries"
              :key="option.value"
              :value="option.value"
              :disabled="option.disabled"
              :class="styles.item({ class: ui?.item })"
            >
              <ComboboxItemIndicator :class="styles.indicator({ class: ui?.indicator })">
                <icon-lucide-check class="size-3 text-accent" />
              </ComboboxItemIndicator>
              <slot name="option" :option="option">
                <div class="min-w-0 flex-1">
                  <div class="truncate text-surface">{{ option.label }}</div>
                  <div
                    v-if="option.description || option.value !== option.label"
                    :class="styles.description({ class: ui?.description })"
                  >
                    {{ option.description ?? option.value }}
                  </div>
                </div>
                <span v-if="option.meta" :class="styles.meta({ class: ui?.meta })">
                  {{ option.meta }}
                </span>
              </slot>
            </ComboboxItem>
          </ComboboxGroup>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
