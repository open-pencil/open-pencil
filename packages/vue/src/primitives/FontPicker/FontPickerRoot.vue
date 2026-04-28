<script setup lang="ts">
import { nextTick, ref } from 'vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxVirtualizer,
  ComboboxViewport,
  type AcceptableValue
} from 'reka-ui'

import { useFontPicker } from '#vue/primitives/FontPicker/useFontPicker'

const {
  listFamilies,
  triggerClass,
  contentClass,
  itemClass,
  searchClass,
  viewportClass,
  emptyClass,
  emptySearchText,
  emptyFontsText,
  emptyFontsHint
} = defineProps<{
  listFamilies: () => Promise<string[]>
  triggerClass?: string
  contentClass?: string
  itemClass?: string
  searchClass?: string
  viewportClass?: string
  emptyClass?: string
  emptySearchText?: string
  emptyFontsText?: string
  emptyFontsHint?: string
}>()

const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [family: string] }>()

const inputRef = ref<HTMLInputElement | null>(null)

function setInputRef(el: HTMLInputElement | null) {
  inputRef.value = el
}

const { searchTerm, open, filtered, select } = useFontPicker({
  modelValue,
  listFamilies,
  onSelect: (family) => emit('select', family)
})
</script>

<template>
  <ComboboxRoot
    v-model:open="open"
    :model-value="modelValue"
    :ignore-filter="true"
    @update:model-value="
      (v: AcceptableValue) => {
        if (typeof v === 'string') select(v)
      }
    "
  >
    <ComboboxAnchor as-child>
      <slot name="trigger" :value="modelValue" :open="open">
        <button :class="triggerClass">
          <span class="truncate">{{ modelValue }}</span>
        </button>
      </slot>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        :side-offset="2"
        align="start"
        position="popper"
        :class="contentClass"
        @open-auto-focus.prevent
        @vue:mounted="nextTick(() => inputRef?.focus())"
      >
        <slot name="search" :search-term="searchTerm" :set-input-ref="setInputRef">
          <ComboboxInput
            ref="inputRef"
            v-model="searchTerm"
            :class="searchClass"
            placeholder="Search fonts…"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
        </slot>

        <ComboboxViewport :class="viewportClass ?? 'max-h-72 overflow-y-auto'">
          <ComboboxVirtualizer
            v-slot="{ option }"
            :options="filtered"
            :text-content="(family: string) => family"
            :estimate-size="36"
          >
            <slot name="item" :family="option" :selected="option === modelValue">
              <ComboboxItem
                :value="option"
                :class="itemClass"
                :style="{ fontFamily: `'${option}', sans-serif` }"
              >
                <ComboboxItemIndicator>
                  <slot name="indicator" :selected="option === modelValue" />
                </ComboboxItemIndicator>
                <span class="truncate">{{ option }}</span>
              </ComboboxItem>
            </slot>
          </ComboboxVirtualizer>

          <div v-if="filtered.length === 0 && searchTerm" :class="emptyClass">
            {{ emptySearchText ?? 'No fonts found' }}
          </div>
          <div v-else-if="filtered.length === 0" :class="emptyClass">
            <slot name="empty">
              <div>
                <p>{{ emptyFontsText ?? 'No local fonts available.' }}</p>
                <p v-if="emptyFontsHint" class="mt-1">{{ emptyFontsHint }}</p>
              </div>
            </slot>
          </div>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
