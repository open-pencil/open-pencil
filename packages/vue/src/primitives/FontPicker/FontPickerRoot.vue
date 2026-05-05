<script setup lang="ts">
import { nextTick } from 'vue'
import { templateRef, unrefElement } from '@vueuse/core'
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

import { useFontPicker, type FontAccessController } from '#vue/primitives/FontPicker/useFontPicker'

import type { FontPickerUi } from '#vue/primitives/FontPicker/types'

const { listFamilies, localFontAccess, ui, emptySearchText, emptyFontsText, emptyFontsHint } =
  defineProps<{
    listFamilies: () => Promise<string[]>
    localFontAccess?: FontAccessController
    ui?: FontPickerUi
    emptySearchText?: string
    emptyFontsText?: string
    emptyFontsHint?: string
  }>()

const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [family: string] }>()

const contentRef = templateRef<HTMLElement>('contentRef')

function focusSearchInput() {
  nextTick(() => {
    const content = unrefElement(contentRef)
    if (!(content instanceof HTMLElement)) return
    content.querySelector<HTMLInputElement>('input')?.focus()
  })
}

const { searchTerm, open, filtered, loading, accessState, requestAccess, select } = useFontPicker({
  modelValue,
  listFamilies,
  localFontAccess,
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
        <button :class="ui?.trigger">
          <span class="truncate">{{ modelValue }}</span>
        </button>
      </slot>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        :side-offset="2"
        align="start"
        position="popper"
        :class="ui?.content"
        @open-auto-focus.prevent
        ref="contentRef"
        @vue:mounted="focusSearchInput"
      >
        <slot name="search" :search-term="searchTerm">
          <ComboboxInput
            v-model="searchTerm"
            :class="ui?.search"
            placeholder="Search fonts…"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
        </slot>

        <ComboboxViewport :class="ui?.viewport ?? 'max-h-72 overflow-y-auto'">
          <ComboboxVirtualizer
            v-slot="{ option }"
            :options="filtered"
            :text-content="(family: string) => family"
            :estimate-size="36"
          >
            <slot name="item" :family="option" :selected="option === modelValue">
              <ComboboxItem
                :value="option"
                :class="ui?.item"
                :style="{ fontFamily: `'${option}', sans-serif` }"
              >
                <ComboboxItemIndicator>
                  <slot name="indicator" :selected="option === modelValue" />
                </ComboboxItemIndicator>
                <span class="truncate">{{ option }}</span>
              </ComboboxItem>
            </slot>
          </ComboboxVirtualizer>

          <div v-if="filtered.length === 0 && searchTerm" :class="ui?.empty">
            {{ emptySearchText ?? 'No fonts found' }}
          </div>
          <div v-else-if="filtered.length === 0" :class="ui?.empty">
            <div>
              <p v-if="accessState === 'prompt'">
                Allow local font access to browse installed fonts.
              </p>
              <p v-else-if="accessState === 'denied'">
                Local font access is blocked for this site.
              </p>
              <p v-else-if="accessState === 'unsupported'">
                Local fonts are not available in this browser.
              </p>
              <p v-else>{{ emptyFontsText ?? 'No local fonts available.' }}</p>
              <p v-if="emptyFontsHint" class="mt-1">{{ emptyFontsHint }}</p>
              <button
                v-if="accessState === 'prompt'"
                type="button"
                :class="ui?.emptyAction"
                :disabled="loading"
                @click="requestAccess"
              >
                {{ loading ? 'Loading…' : 'Allow local fonts' }}
              </button>
            </div>
          </div>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
