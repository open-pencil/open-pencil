<script lang="ts">
import type { BindingFieldUI } from '@/components/ui/binding'

export interface VariableBindingPickerProps {
  triggerLabel: string
  searchPlaceholder: string
  emptyLabel: string
  detachLabel: string
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
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxTrigger,
  ComboboxViewport
} from 'reka-ui'
import { computed, nextTick, ref, watch } from 'vue'

import { BindableValuePicker, useBindableValue } from '@open-pencil/vue'

import Tip from '@/components/ui/Tip.vue'
import { BindingTrigger, useBindingFieldUI } from '@/components/ui/binding'

const {
  triggerLabel,
  searchPlaceholder,
  emptyLabel,
  detachLabel,
  createLabel,
  createNamePlaceholder = 'Variable name',
  createSubmitLabel = 'Create',
  createDefaultName = '',
  disabled = false,
  derived = false,
  ui
} = defineProps<VariableBindingPickerProps>()

const binding = useBindableValue<number>()
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
function updateSearch(value: unknown) {
  if (typeof value === 'string') binding.actions.setSearchTerm(value)
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
  if (!name) return
  binding.actions.create(name)
}

function detach() {
  binding.actions.unbind()
  binding.actions.closePicker()
}

watch(binding.open, (open) => {
  if (open) return
  creating.value = false
  binding.actions.setSearchTerm('')
})

defineOptions({ inheritAttrs: false })
</script>

<template>
  <BindableValuePicker v-slot="picker">
    <ComboboxAnchor class="contents" data-slot="anchor">
      <Tip :label="triggerLabel">
        <ComboboxTrigger as-child>
          <BindingTrigger
            :label="triggerLabel"
            :state="picker.state"
            :open="picker.open"
            :disabled="disabled"
            :derived="derived"
            :ui="ui"
          />
        </ComboboxTrigger>
      </Tip>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        v-if="picker.open"
        position="popper"
        side="left"
        align="center"
        :side-offset="8"
        :collision-padding="8"
        :class="styles.pickerContent"
        data-slot="content"
      >
        <ComboboxInput
          :model-value="picker.searchTerm"
          :placeholder="searchPlaceholder"
          :class="styles.pickerSearch"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          :spellcheck="false"
          data-slot="search"
          @update:model-value="updateSearch"
        />
        <ComboboxViewport :class="styles.pickerViewport" data-slot="viewport">
          <div v-if="picker.variables.length === 0" :class="styles.pickerEmpty" data-slot="empty">
            {{ emptyLabel }}
          </div>
          <ComboboxItem
            v-for="variable in picker.variables"
            :key="variable.id"
            :value="variable"
            :text-value="variable.name"
            :class="styles.pickerItem"
            data-slot="item"
          >
            <icon-lucide-diamond :class="styles.pickerItemIcon" data-slot="itemIcon" />
            <span :class="styles.pickerItemLabel" data-slot="itemLabel">{{ variable.name }}</span>
            <ComboboxItemIndicator :class="styles.pickerItemIndicator" data-slot="itemIndicator">
              <icon-lucide-check class="size-3" />
            </ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxViewport>

        <div :class="styles.pickerFooter" data-slot="footer">
          <button
            v-if="picker.state === 'bound'"
            type="button"
            :class="styles.pickerAction"
            data-slot="action"
            @click="detach"
          >
            <icon-lucide-unlink class="size-3" />
            <span>{{ detachLabel }}</span>
          </button>

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
            <button
              :disabled="!canCreate"
              :class="styles.createSubmit"
              data-slot="createSubmit"
              type="submit"
            >
              {{ createSubmitLabel }}
            </button>
          </form>
          <button
            v-else-if="createLabel"
            type="button"
            :class="styles.pickerAction"
            data-slot="action"
            @click="startCreate"
          >
            <icon-lucide-plus class="size-3" />
            <span class="min-w-0 flex-1 truncate">{{ createLabel }}</span>
          </button>
        </div>
      </ComboboxContent>
    </ComboboxPortal>
  </BindableValuePicker>
</template>
