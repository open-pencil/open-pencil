<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { AcceptableValue, ListboxFilter } from 'reka-ui'
import {
  ListboxContent,
  ListboxItem,
  ListboxRoot,
  ListboxVirtualizer,
  PopoverAnchor,
  PopoverContent,
  PopoverRoot
} from 'reka-ui'
import { FontPickerRoot } from '@open-pencil/vue'

import { selectItem, selectTrigger } from '@/components/ui/select'
import { panelSurface } from '@/components/ui/surface'
import { listFamilies } from '@/engine/fonts'

defineModel<string>({ required: true })
defineEmits<{ select: [family: string] }>()

const filterRef = ref<InstanceType<typeof ListboxFilter> | null>(null)
</script>

<template>
  <FontPickerRoot
    v-model="modelValue"
    :list-families="listFamilies"
    @select="$emit('select', $event)"
    v-slot="{ filtered, searchTerm, open, modelValue: selected, select, setSearchTerm, setOpen }"
  >
    <PopoverRoot :open="open" @update:open="setOpen">
      <PopoverAnchor>
        <button
          data-test-id="font-picker-trigger"
          :class="selectTrigger({ class: 'w-full rounded px-2 py-1 text-xs' })"
          @click="setOpen(!open)"
        >
          <span class="truncate">{{ selected }}</span>
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
          :model-value="selected"
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
              @input="setSearchTerm(($event.target as HTMLInputElement).value)"
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
                <icon-lucide-check v-if="option === selected" class="size-3 shrink-0 text-accent" />
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
  </FontPickerRoot>
</template>
