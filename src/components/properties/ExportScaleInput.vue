<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger
} from 'reka-ui'
import { onDeactivated, ref, watch } from 'vue'

import { useRetainedPopup } from '@open-pencil/vue/lifecycle/retention'

import { useInputUI } from '@/components/ui/input/input'
import AppDropdownMenuRoot from '@/components/ui/menu/AppDropdownMenuRoot.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import { useSelectFieldTriggerUI } from '@/components/ui/select/field-trigger'
import { panelFieldBase } from '@/theme/panel/field/base'

interface ExportScaleInputProps {
  presets: readonly number[]
  clamp: (scale: number) => number
  label?: string
}

defineOptions({ inheritAttrs: false })

const { presets, clamp, label } = defineProps<ExportScaleInputProps>()

const modelValue = defineModel<number>({ required: true })

const { open, portalActive } = useRetainedPopup()
const inputRef = ref<HTMLInputElement | null>(null)
const text = ref('')
onDeactivated(() => {
  text.value = `${modelValue.value}x`
})

// Keep the editable text in sync with the committed scale (e.g. 1.5 -> "1.5x").
watch(modelValue, (value) => (text.value = `${value}x`), { immediate: true })

const inputClass = useInputUI({
  size: 'xs',
  ui: {
    base: 'h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-1.5 text-2xs focus:border-transparent focus:ring-0'
  }
}).base
const trigger = useSelectFieldTriggerUI()
const menuCls = useMenuUI({ content: 'min-w-[7rem]' })
const itemCls = menuItem({ justify: 'between' })

function commit() {
  const parsed = Number.parseFloat(text.value.replace(/[^0-9.]/g, ''))
  if (portalActive.value && Number.isFinite(parsed) && parsed > 0) modelValue.value = clamp(parsed)
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
    <div :class="[panelFieldBase, 'flex min-w-0 flex-1 items-center overflow-hidden pe-0.5']">
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
      <AppDropdownMenuRoot v-model:open="open">
        <DropdownMenuTrigger as-child>
          <button type="button" :aria-label="label" :class="trigger.root">
            <icon-lucide-chevron-down :class="trigger.chevron" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal v-if="portalActive">
          <DropdownMenuContent side="bottom" align="end" :side-offset="4" :class="menuCls.content">
            <MenuScrollArea>
              <DropdownMenuItem
                v-for="scale in presets"
                :key="scale"
                :class="itemCls"
                @select="pick(scale)"
              >
                <span>{{ scale }}x</span>
                <icon-lucide-check v-if="isActive(scale)" class="size-3 text-primary" />
              </DropdownMenuItem>
            </MenuScrollArea>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </AppDropdownMenuRoot>
    </div>
  </Tip>
</template>
