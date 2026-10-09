<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import FillSwatch from '@/components/ui/paint/FillSwatch.vue'
import AppPicker, { type AppPickerItem } from '@/components/ui/select/AppPicker.vue'

import BindingTrigger from './BindingTrigger.vue'
import type { VariablePickerProps } from './picker'
import { useBindingFieldUI } from './ui'

/**
 * Picks the variable a value points at: the Properties panel binds a layer's field with it and
 * the Variables dialog aliases a mode's value, so both look and work the same.
 */
const {
  items,
  selected,
  state,
  triggerLabel,
  searchPlaceholder,
  emptyLabel,
  detachLabel,
  closeLabel,
  createLabel,
  createNamePlaceholder = 'Variable name',
  createSubmitLabel = 'Create',
  createDefaultName = '',
  disabled = false,
  derived = false,
  side,
  ui
} = defineProps<VariablePickerProps>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ select: [id: string]; detach: []; create: [name: string] }>()

const { common } = useI18n()
const creating = ref(false)
const createName = ref('')
const createInput = ref<HTMLInputElement | null>(null)
const canCreate = computed(() => createName.value.trim().length > 0)
const styles = computed(() => useBindingFieldUI({ state, open: open.value, disabled, derived }, ui))
const pickerItems = computed<AppPickerItem[]>(() =>
  items.map((item) => ({ value: item.id, label: item.name, group: item.collection }))
)

function color(id: string) {
  return items.find((item) => item.id === id)?.color
}

function startCreate() {
  creating.value = true
  createName.value = createDefaultName
  void nextTick(() => {
    createInput.value?.focus()
    createInput.value?.select()
  })
}

function submitCreate() {
  const name = createName.value.trim()
  if (name) emit('create', name)
}

function detach() {
  emit('detach')
  open.value = false
}

watch(open, (isOpen) => {
  if (!isOpen) creating.value = false
})

defineOptions({ inheritAttrs: false })
</script>

<template>
  <span class="inline-flex shrink-0 items-center" data-slot="anchor">
    <AppPicker
      v-model:open="open"
      :heading="triggerLabel"
      :items="pickerItems"
      :selected="selected"
      density="compact"
      :search-placeholder="searchPlaceholder"
      :empty-label="emptyLabel"
      :close-label="closeLabel ?? common.close"
      :tooltip="triggerLabel"
      :side="side"
      @select="emit('select', $event)"
    >
      <template #trigger>
        <BindingTrigger
          v-bind="$attrs"
          :label="triggerLabel"
          :state="state"
          :open="open"
          :disabled="disabled"
          :derived="derived"
          :ui="ui"
        />
      </template>
      <template #leading="{ item }">
        <FillSwatch
          v-if="color(item.value)"
          :fill="{
            type: 'SOLID',
            visible: true,
            opacity: color(item.value)?.a ?? 1,
            color: color(item.value) ?? { r: 0, g: 0, b: 0, a: 1 }
          }"
          :ui="{ root: 'size-3.5 shrink-0 rounded-sm' }"
        />
        <icon-lucide-diamond v-else class="size-3.5 text-component" />
      </template>
      <template #footer>
        <AppButton
          v-if="state !== 'unbound'"
          size="xs"
          class="w-full justify-start"
          data-slot="action"
          @click="detach"
        >
          <template #leading><icon-lucide-unlink class="size-3" /></template>
          {{ detachLabel }}
        </AppButton>
        <form
          v-if="creating"
          :class="styles.createForm"
          data-slot="createForm"
          @submit.prevent="submitCreate"
          @keydown.esc.prevent.stop="creating = false"
        >
          <input
            ref="createInput"
            v-model="createName"
            :placeholder="createNamePlaceholder"
            :class="styles.createInput"
            data-slot="createInput"
          />
          <AppButton
            size="xs"
            variant="soft"
            :disabled="!canCreate"
            data-slot="createSubmit"
            type="submit"
          >
            {{ createSubmitLabel }}
          </AppButton>
        </form>
        <AppButton
          v-else-if="createLabel"
          size="xs"
          class="w-full justify-start"
          data-slot="action"
          @click="startCreate"
        >
          <template #leading><icon-lucide-plus class="size-3" /></template>
          <span class="min-w-0 flex-1 truncate text-left">{{ createLabel }}</span>
        </AppButton>
      </template>
    </AppPicker>
  </span>
</template>
