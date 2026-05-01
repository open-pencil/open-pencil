<script setup lang="ts">
import {
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'

import { computed, nextTick, ref, watch } from 'vue'

import type { Variable } from '@open-pencil/core/scene-graph'

const searchTerm = defineModel<string>('searchTerm', { default: '' })

const {
  variables,
  triggerLabel,
  searchPlaceholder,
  emptyLabel,
  createLabel,
  createNamePlaceholder = 'Variable name',
  createSubmitLabel = 'Create',
  createDefaultName = '',
  createTestId,
  triggerTestId,
  swatchBackground
} = defineProps<{
  variables: Variable[]
  triggerLabel: string
  searchPlaceholder: string
  emptyLabel: string
  createLabel?: string
  createNamePlaceholder?: string
  createSubmitLabel?: string
  createDefaultName?: string
  createTestId?: string
  triggerTestId?: string
  swatchBackground?: (variableId: string) => string
}>()

const emit = defineEmits<{
  select: [variable: Variable]
  create: [name: string]
}>()

const open = ref(false)
const creating = ref(false)
const createName = ref('')
const createInput = ref<HTMLInputElement | null>(null)
const canCreate = computed(() => createName.value.trim().length > 0)

watch(open, (value) => {
  if (!value) creating.value = false
})

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
  emit('create', name)
  open.value = false
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger
      :data-test-id="triggerTestId"
      :aria-label="triggerLabel"
      :title="triggerLabel"
      class="shrink-0 cursor-pointer border-none bg-transparent p-0 text-muted hover:text-surface"
      @pointerdown.stop
    >
      <icon-lucide-diamond-plus class="size-3.5" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="left"
        align="center"
        :side-offset="8"
        :collision-padding="8"
        class="z-50 w-56 rounded-lg border border-border bg-panel shadow-lg"
      >
        <ComboboxRoot
          :open="true"
          :ignore-filter="true"
          @update:model-value="
            ($event) => {
              if ($event) {
                emit('select', $event as Variable)
                open = false
              }
            }
          "
        >
          <ComboboxInput
            v-model="searchTerm"
            :placeholder="searchPlaceholder"
            class="w-full border-b border-border bg-transparent px-2 py-1.5 text-[11px] text-surface outline-none placeholder:text-muted"
          />
          <ComboboxContent class="max-h-48 overflow-y-auto p-1">
            <div v-if="variables.length === 0" class="px-2 py-3 text-center text-[11px] text-muted">
              {{ emptyLabel }}
            </div>
            <ComboboxItem
              v-for="variable in variables"
              :key="variable.id"
              :value="variable"
              :text-value="variable.name"
              class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[11px] text-surface data-[highlighted]:bg-hover"
            >
              <div
                v-if="swatchBackground"
                class="size-3 shrink-0 rounded-sm border border-border"
                :style="{ background: swatchBackground(variable.id) }"
              />
              <icon-lucide-diamond v-else class="size-3 shrink-0 text-violet-400" />
              <span class="min-w-0 flex-1 truncate">{{ variable.name }}</span>
            </ComboboxItem>
          </ComboboxContent>
          <div v-if="createLabel" class="border-t border-border">
            <form
              v-if="creating"
              class="flex items-center gap-1.5 p-1.5"
              @submit.prevent="submitCreate"
              @keydown.esc.prevent="creating = false"
            >
              <input
                ref="createInput"
                v-model="createName"
                :placeholder="createNamePlaceholder"
                class="min-w-0 flex-1 rounded border border-border bg-transparent px-1.5 py-1 text-[11px] text-surface outline-none placeholder:text-muted focus:border-accent"
              />
              <button
                :data-test-id="createTestId"
                :disabled="!canCreate"
                class="rounded border border-border bg-panel px-1.5 py-1 text-[11px] text-surface hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
              >
                {{ createSubmitLabel }}
              </button>
            </form>
            <button
              v-else
              :data-test-id="createTestId"
              class="flex w-full cursor-pointer items-center gap-1.5 bg-transparent px-2 py-1.5 text-left text-[11px] text-muted hover:bg-hover hover:text-surface"
              @click="startCreate"
            >
              <icon-lucide-plus class="size-3" />
              <span class="min-w-0 flex-1 truncate">{{ createLabel }}</span>
            </button>
          </div>
        </ComboboxRoot>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
