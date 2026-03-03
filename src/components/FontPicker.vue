<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  ListboxContent,
  ListboxFilter,
  ListboxItem,
  ListboxRoot,
  ListboxVirtualizer,
  PopoverAnchor,
  PopoverContent,
  PopoverRoot,
  useFilter
} from 'reka-ui'

import { listFamilies } from '@/engine/fonts'

const modelValue = defineModel<string>({ required: true })
const emit = defineEmits<{ select: [family: string] }>()

const families = ref<string[]>([])
const searchTerm = ref('')
const open = ref(false)
const filterRef = ref<InstanceType<typeof ListboxFilter> | null>(null)

const { contains } = useFilter({ sensitivity: 'base' })
const filtered = computed(() => {
  if (!searchTerm.value) return families.value
  return families.value.filter((f) => contains(f, searchTerm.value))
})

onMounted(async () => {
  families.value = await listFamilies()
})

watch(open, (isOpen) => {
  if (isOpen) {
    searchTerm.value = ''
    nextTick(() => filterRef.value?.$el?.focus())
  }
})

function onSelect(val: string) {
  modelValue.value = val
  emit('select', val)
  open.value = false
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverAnchor>
      <button
        class="flex w-full cursor-pointer items-center justify-between rounded border border-border bg-input px-2 py-1 text-xs text-surface hover:bg-hover"
        @click="open = !open"
      >
        <span class="truncate">{{ modelValue }}</span>
        <icon-lucide-chevron-down class="size-3 shrink-0 text-muted" />
      </button>
    </PopoverAnchor>
    <PopoverContent
      :side-offset="2"
      align="start"
      class="z-50 flex min-w-56 w-[var(--reka-popper-anchor-width)] flex-col overflow-hidden rounded-md border border-border bg-panel shadow-lg"
      @open-auto-focus.prevent
    >
      <ListboxRoot :model-value="modelValue" @update:model-value="onSelect">
        <div class="flex items-center gap-1 border-b border-border px-2 py-1">
          <icon-lucide-search class="size-3 shrink-0 text-muted" />
          <ListboxFilter
            ref="filterRef"
            v-model="searchTerm"
            class="min-w-0 flex-1 border-none bg-transparent text-xs text-surface outline-none placeholder:text-muted"
            placeholder="Search fonts…"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
        </div>
        <ListboxContent class="h-72 overflow-y-auto">
          <ListboxVirtualizer
            v-slot="{ option }"
            :options="filtered"
            :text-content="(f: string) => f"
            :estimate-size="36"
          >
            <ListboxItem
              :value="option"
              class="flex w-full cursor-pointer items-center gap-2 px-2 py-2 text-sm text-surface outline-none data-[highlighted]:bg-hover"
              :style="{ fontFamily: `'${option}', sans-serif` }"
            >
              <icon-lucide-check v-if="option === modelValue" class="size-3 shrink-0 text-accent" />
              <span v-else class="size-3 shrink-0" />
              <span class="truncate">{{ option }}</span>
            </ListboxItem>
          </ListboxVirtualizer>
          <div
            v-if="families.length === 0"
            class="flex h-full items-center justify-center px-3 text-center text-xs text-muted"
          >
            <div>
              <p>No local fonts available.</p>
              <p class="mt-1">Use the desktop app or Chrome/Edge to access system fonts.</p>
            </div>
          </div>
          <div v-else-if="filtered.length === 0" class="px-2 py-3 text-center text-xs text-muted">
            No fonts found
          </div>
        </ListboxContent>
      </ListboxRoot>
    </PopoverContent>
  </PopoverRoot>
</template>
