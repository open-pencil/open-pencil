<script lang="ts">
import type { BindingFieldUI } from '@/components/ui/binding'

export interface VariableBindingPickerProps {
  triggerLabel: string
  searchPlaceholder: string
  emptyLabel: string
  detachLabel: string
  closeLabel?: string
  createLabel?: string
  createNamePlaceholder?: string
  createSubmitLabel?: string
  createDefaultName?: string
  disabled?: boolean
  derived?: boolean
  ui?: BindingFieldUI
}
</script>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { useBindableValue, useI18n } from '@open-pencil/vue'

import { BindingTrigger, useBindingFieldUI } from '@/components/ui/binding'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPicker, { type AppPickerItem } from '@/components/ui/select/AppPicker.vue'

const {
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
  ui
} = defineProps<VariableBindingPickerProps>()

const binding = useBindableValue<unknown>()
const { common } = useI18n()
const creating = ref(false)
const createName = ref('')
const createInput = ref<HTMLInputElement | null>(null)
const canCreate = computed(() => createName.value.trim().length > 0)
const styles = computed(() =>
  useBindingFieldUI(
    {
      state: binding.state.value,
      open: binding.open.value,
      disabled,
      derived
    },
    ui
  )
)
const open = computed({
  get: () => binding.open.value,
  set: (value: boolean) => (value ? binding.actions.openPicker() : binding.actions.closePicker())
})
const items = computed<AppPickerItem[]>(() =>
  binding.variables.value.map((variable) => ({ value: variable.id, label: variable.name }))
)

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
  if (!name) return
  binding.actions.create(name)
}

function detach() {
  binding.actions.unbind()
  binding.actions.closePicker()
}

watch(binding.open, (isOpen) => {
  if (!isOpen) creating.value = false
})

defineOptions({ inheritAttrs: false })
</script>

<template>
  <span class="inline-flex shrink-0 items-center" data-slot="anchor">
    <AppPicker
      v-model:open="open"
      :heading="triggerLabel"
      :items="items"
      :selected="binding.variable.value?.id"
      density="compact"
      :search-placeholder="searchPlaceholder"
      :empty-label="emptyLabel"
      :close-label="closeLabel ?? common.close"
      :tooltip="triggerLabel"
      @select="binding.actions.bind($event)"
    >
      <template #trigger>
        <BindingTrigger
          :label="triggerLabel"
          :state="binding.state.value"
          :open="binding.open.value"
          :disabled="disabled"
          :derived="derived"
          :ui="ui"
        />
      </template>
      <template #leading>
        <icon-lucide-diamond class="size-3.5 text-component" />
      </template>
      <template #footer>
        <AppButton
          v-if="binding.state.value !== 'unbound'"
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
