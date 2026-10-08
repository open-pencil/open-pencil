<script setup lang="ts">
import { omit } from 'es-toolkit'
import { ref, type ComponentPublicInstance } from 'vue'

import type { VariantMutationResult } from '@open-pencil/core/editor'
import { useFlatReorderDrag, useI18n } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

/**
 * A variant property's values: rename in place, drag to reorder, add one, or remove one. A value
 * variants still use is removed by moving them to another value first.
 */
const {
  name,
  values,
  used,
  disabled = false,
  rename,
  reorder,
  add,
  remove
} = defineProps<{
  name: string
  values: string[]
  used: string[]
  disabled?: boolean
  rename: (previous: string, value: string) => boolean | undefined
  reorder: (values: string[]) => boolean | undefined
  add: (value: string) => boolean | undefined
  remove: (value: string, replacement?: string) => VariantMutationResult | undefined
}>()
const { panels } = useI18n()
const drafts = ref<Record<string, string>>({})
const newValue = ref('')
const replacing = ref<string | null>(null)
const conflict = ref(false)

const drag = useFlatReorderDrag({
  items: () => values.map((value) => ({ id: value })),
  onMove: (value, index) => {
    const next = values.filter((item) => item !== value)
    next.splice(index, 0, value)
    reorder(next)
  }
})

function setupRow(element: Element | ComponentPublicInstance | null, value: string) {
  drag.setupItem(element instanceof HTMLElement ? element : null, () => ({ id: value }))
}

function commitRename(value: string) {
  const next = drafts.value[value]?.trim()
  if (next && next !== value) rename(value, next)
  // The row shows the stored value again, renamed or not.
  drafts.value = omit(drafts.value, [value])
}

function commitAdd() {
  if (newValue.value.trim() && add(newValue.value.trim())) newValue.value = ''
}

function startRemove(value: string) {
  conflict.value = false
  if (!used.includes(value)) {
    remove(value)
    return
  }
  replacing.value = value
}

function replace(value: string, replacement: string) {
  const result = remove(value, replacement)
  conflict.value = result?.kind === 'conflict'
  if (result?.kind === 'changed') replacing.value = null
}
</script>

<template>
  <div class="flex flex-col gap-1" :data-variant-values="name">
    <div
      v-for="value in values"
      :key="value"
      :ref="(element) => setupRow(element, value)"
      class="group/value relative flex flex-col gap-1"
      :data-dragging="drag.draggingId.value === value || undefined"
    >
      <div
        v-if="drag.instructionTargetId.value === value"
        class="pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-accent"
        :class="drag.instruction.value?.operation === 'reorder-before' ? '-top-0.5' : '-bottom-0.5'"
      />
      <div class="flex items-center gap-1">
        <icon-lucide-grip-vertical
          class="size-3.5 shrink-0 cursor-grab text-muted opacity-0 group-hover/value:opacity-100"
          aria-hidden="true"
        />
        <AppInput
          :model-value="drafts[value] ?? value"
          size="sm"
          tone="panel"
          :aria-label="`${name}: ${value}`"
          :disabled="disabled"
          @update:model-value="drafts[value] = String($event)"
          @change="commitRename(value)"
          @enter="commitRename(value)"
        />
        <IconButton
          :label="panels.removeVariantValue({ value })"
          :disabled="disabled || values.length < 2"
          @click="startRemove(value)"
        >
          <icon-lucide-minus class="size-3.5" />
        </IconButton>
      </div>
      <div v-if="replacing === value" class="flex flex-col gap-1 pl-5">
        <span class="text-[11px] text-muted">{{ panels.moveVariantsTo({ value }) }}</span>
        <AppSelect
          :label="panels.moveVariantsTo({ value })"
          :model-value="''"
          :options="
            values.filter((item) => item !== value).map((item) => ({ value: item, label: item }))
          "
          @update:model-value="replace(value, $event)"
        />
        <span v-if="conflict" role="alert" class="text-[11px] text-issue-warning">
          {{ panels.duplicateVariantValues }}
        </span>
      </div>
    </div>
    <div class="flex items-center gap-1">
      <span class="size-3.5 shrink-0" aria-hidden="true" />
      <AppInput
        v-model="newValue"
        size="sm"
        tone="panel"
        :placeholder="panels.addVariantValue"
        :aria-label="panels.addVariantValue"
        :disabled="disabled"
        @enter="commitAdd"
        @change="commitAdd"
      />
      <!-- Keeps the field as wide as the values above, whose rows end in a remove button. -->
      <IconButton
        :label="panels.addVariantValue"
        class="invisible"
        aria-hidden="true"
        tabindex="-1"
      >
        <icon-lucide-minus class="size-3.5" />
      </IconButton>
    </div>
  </div>
</template>
