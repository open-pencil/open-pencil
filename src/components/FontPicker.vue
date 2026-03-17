<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  type AcceptableValue,
  type ListboxFilter,
  ListboxContent,
  ListboxItem,
  ListboxRoot,
  ListboxVirtualizer,
  PopoverAnchor,
  PopoverContent,
  PopoverRoot,
  useFilter
} from 'reka-ui'

import { selectItem, selectTrigger } from '@/components/ui/select'
import { panelSurface } from '@/components/ui/surface'
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
  if (isOpen) searchTerm.value = ''
})

function select(family: string) {
  modelValue.value = family
  emit('select', family)
  open.value = false
}
</script>

<template>
  <PopoverRoot :open="open" @update:open="(v) => (open = v)">
    <PopoverAnchor>
      <button
        data-test-id="font-picker-trigger"
        :class="selectTrigger({ class: 'w-full rounded px-2 py-1 text-xs' })"
        @click="open = !open"
      >
        <span class="truncate">{{ modelValue }}</span>
        <icon-lucide-chevron-down class="size-3 shrink-0 text-muted" />
      </button>
    </PopoverAnchor>
    <PopoverContent
      :side-offset="2"
      align="start"
      :class="
        panelSurface({
          radius: 'md',
          padding: 'none',
          class: 'z-50 flex w-[var(--reka-popper-anchor-width)] min-w-56 flex-col overflow-hidden'
        })
      "
      @open-auto-focus.prevent
      @vue:mounted="nextTick(() => filterRef?.$el?.focus())"
    >
      <ListboxRoot
        :model-value="modelValue"
        @update:model-value="
          (v: AcceptableValue) => {
            if (typeof v === 'string') select(v)
          }
        "
      >
        <div class="flex items-center gap-1 border-b border-border px-2 py-1">
          <icon-lucide-search class="size-3 shrink-0 text-muted" />
          <input
            ref="filterRef"
            :value="searchTerm"
            data-test-id="font-picker-search"
            class="min-w-0 flex-1 border-none bg-transparent text-xs text-surface outline-none placeholder:text-muted"
            placeholder="Search fonts…"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            @input="searchTerm = ($event.target as HTMLInputElement).value"
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
              data-test-id="font-picker-item"
              :class="selectItem({ class: 'w-full gap-2 px-2 py-2 text-sm' })"
              :style="{ fontFamily: `'${option}', sans-serif` }"
            >
              <icon-lucide-check v-if="option === modelValue" class="size-3 shrink-0 text-accent" />
              <span v-else class="size-3 shrink-0" />
              <span class="truncate">{{ option }}</span>
            </ListboxItem>
          </ListboxVirtualizer>
          <div
            v-if="filtered.length === 0 && searchTerm"
            class="px-2 py-3 text-center text-xs text-muted"
          >
            No fonts found
          </div>
          <div
            v-else-if="filtered.length === 0"
            class="flex h-full items-center justify-center px-3 text-center text-xs text-muted"
          >
            <div>
              <p>No local fonts available.</p>
              <p class="mt-1">Use the desktop app or Chrome/Edge to access system fonts.</p>
            </div>
          </div>
        </ListboxContent>
      </ListboxRoot>
    </PopoverContent>
  </PopoverRoot>
</template>
