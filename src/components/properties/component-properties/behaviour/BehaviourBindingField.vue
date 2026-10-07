<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppPickerField from '@/components/ui/select/AppPickerField.vue'

/**
 * One binding of a behaviour row: a picker of the component's matching properties or slots,
 * whose footer creates a new one, or, when it has none, that create action alone.
 */
const {
  label,
  propertyId,
  options,
  placeholder,
  emptyLabel,
  createLabel,
  missing = false
} = defineProps<{
  label: string
  propertyId: string | null
  options: { id: string; name: string }[]
  placeholder: string
  emptyLabel: string
  /** The action that creates a property or slot when the component has none. */
  createLabel: string
  missing?: boolean
}>()
const emit = defineEmits<{ bind: [propertyId: string]; create: [] }>()
defineOptions({ inheritAttrs: false })
const { panels, common } = useI18n()

const items = computed(() => options.map((option) => ({ value: option.id, label: option.name })))
</script>

<template>
  <AppPickerField
    v-if="options.length"
    :model-value="propertyId ?? ''"
    :items="items"
    :label="label"
    :placeholder="placeholder"
    :search-placeholder="panels.searchComponentProperties"
    :empty-label="emptyLabel"
    :close-label="common.close"
    :data-missing="(missing && !propertyId) || undefined"
    v-bind="$attrs"
    @update:model-value="emit('bind', $event)"
  >
    <template #footer="{ close }">
      <AppButton
        size="xs"
        class="w-full justify-start"
        data-slot="action"
        @click="
          () => {
            close()
            emit('create')
          }
        "
      >
        <template #leading><icon-lucide-plus class="size-3" /></template>
        {{ createLabel }}
      </AppButton>
    </template>
  </AppPickerField>
  <button
    v-else
    type="button"
    class="flex h-6 w-full items-center gap-1.5 rounded border border-dashed border-border px-2 text-xs text-muted outline-none hover:border-accent hover:text-surface focus-visible:border-panel-focus"
    :data-missing="missing || undefined"
    v-bind="$attrs"
    @click="emit('create')"
  >
    <icon-lucide-plus class="size-3 shrink-0" />
    <span class="min-w-0 truncate">{{ createLabel }}</span>
  </button>
</template>
