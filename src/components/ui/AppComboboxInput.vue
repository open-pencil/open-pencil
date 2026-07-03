<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxViewport,
  type AcceptableValue
} from 'reka-ui'

import AppBadge from '@/components/ui/AppBadge.vue'
import { useInputUI } from '@/components/ui/input'
import { useSelectUI } from '@/components/ui/select'

export type AppComboboxOption = {
  value: string
  label: string
  meta?: string
}

interface AppComboboxInputProps {
  options: AppComboboxOption[]
  placeholder?: string
  ui?: {
    input?: string
    content?: string
    item?: string
    viewport?: string
    empty?: string
  }
}

defineOptions({ inheritAttrs: false })

const { options, placeholder, ui } = defineProps<AppComboboxInputProps>()

const modelValue = defineModel<string>({ required: true })
const open = ref(false)

const select = useSelectUI({
  content: ui?.content ?? 'max-h-56 min-w-[var(--reka-combobox-trigger-width)]',
  item: ui?.item ?? 'gap-2 rounded px-2 py-1.5 text-[11px]'
})
const inputClass = computed(() => useInputUI({ size: 'sm', ui: { base: ui?.input } }).base)
const viewportClass = ui?.viewport ?? 'max-h-56 overflow-y-auto p-0.5'
const emptyClass = ui?.empty ?? 'px-2 py-2 text-[11px] text-muted'

const filteredOptions = computed(() => {
  const query = modelValue.value.trim().toLowerCase()
  if (!query) return options.slice(0, 50)
  return options
    .filter((option) => {
      const value = option.value.toLowerCase()
      const label = option.label.toLowerCase()
      return value.includes(query) || label.includes(query)
    })
    .slice(0, 50)
})

function updateValue(value: AcceptableValue) {
  if (typeof value !== 'string') return
  modelValue.value = value
}
</script>

<template>
  <ComboboxRoot
    v-model:open="open"
    :model-value="modelValue"
    :ignore-filter="true"
    open-on-focus
    @update:model-value="updateValue"
  >
    <ComboboxInput
      :model-value="modelValue"
      :display-value="() => modelValue"
      type="text"
      v-bind="$attrs"
      :placeholder="placeholder"
      :class="inputClass"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      @update:model-value="updateValue"
    />

    <ComboboxPortal>
      <ComboboxContent
        v-if="filteredOptions.length || options.length"
        position="popper"
        :side-offset="2"
        :class="select.content"
      >
        <ComboboxViewport :class="viewportClass">
          <ComboboxItem
            v-for="option in filteredOptions"
            :key="option.value"
            :value="option.value"
            :class="select.item"
          >
            <div class="min-w-0 flex-1">
              <div class="truncate text-surface">{{ option.label }}</div>
              <div class="truncate font-mono text-[10px] text-muted">{{ option.value }}</div>
            </div>
            <AppBadge v-if="option.meta">{{ option.meta }}</AppBadge>
          </ComboboxItem>
          <div v-if="filteredOptions.length === 0" :class="emptyClass">No matching models</div>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
