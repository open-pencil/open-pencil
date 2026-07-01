<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import { useInputUI } from '@/components/ui/input'
import { menuItem, useMenuUI } from '@/components/ui/menu'
import Tip from '@/components/ui/Tip.vue'

interface ExportScaleInputProps {
  presets: readonly number[]
  clamp: (scale: number) => number
  label?: string
}

defineOptions({ inheritAttrs: false })

const { presets, clamp, label } = defineProps<ExportScaleInputProps>()

const modelValue = defineModel<number>({ required: true })

const open = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const text = ref('')

// Keep the editable text in sync with the committed scale (e.g. 1.5 -> "1.5x").
watch(modelValue, (value) => (text.value = `${value}x`), { immediate: true })

const inputClass = useInputUI({
  size: 'sm',
  ui: { base: 'min-w-0 flex-1 rounded-none border-0 bg-transparent focus:border-transparent' }
}).base
const menuCls = useMenuUI({ content: 'min-w-[7rem]' })
const itemCls = menuItem({ justify: 'between' })

function commit() {
  const parsed = Number.parseFloat(text.value.replace(/[^0-9.]/g, ''))
  if (Number.isFinite(parsed) && parsed > 0) modelValue.value = clamp(parsed)
  // Reformat from the resulting value: normalizes "9" -> "9x", reverts invalid
  // input, and reflects clamping (e.g. "9999999" -> "1024x").
  text.value = `${modelValue.value}x`
}

function pick(scale: number) {
  modelValue.value = scale
  open.value = false
}

function isActive(scale: number) {
  return Math.abs(modelValue.value - scale) < 1e-9
}
</script>

<template>
  <Tip :label="label" :disabled="!label">
    <div
      class="flex min-w-0 flex-1 overflow-hidden rounded border border-border bg-input focus-within:border-accent"
    >
      <input
        ref="inputRef"
        v-model="text"
        v-bind="$attrs"
        type="text"
        :aria-label="label"
        :class="inputClass"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        @focus="inputRef?.select()"
        @blur="commit"
        @keydown.enter.prevent="inputRef?.blur()"
        @keydown.escape.prevent="((text = `${modelValue}x`), inputRef?.blur())"
      />
      <DropdownMenuRoot v-model:open="open">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            :aria-label="label"
            class="flex shrink-0 cursor-pointer items-center border-l border-border px-1.5 text-surface hover:bg-hover"
          >
            <icon-lucide-chevron-down class="size-3 text-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent side="bottom" align="end" :side-offset="4" :class="menuCls.content">
            <DropdownMenuItem
              v-for="scale in presets"
              :key="scale"
              :class="itemCls"
              @select="pick(scale)"
            >
              <span>{{ scale }}x</span>
              <icon-lucide-check v-if="isActive(scale)" class="size-3 text-accent" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
  </Tip>
</template>
