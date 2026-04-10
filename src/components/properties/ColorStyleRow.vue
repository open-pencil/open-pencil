<script setup lang="ts">
import {
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'

import ScrubInput from '@/components/ScrubInput.vue'
import Tip from '@/components/ui/Tip.vue'
import { useIconButtonUI } from '@/components/ui/icon-button'

import { colorToCSS } from '@open-pencil/core'
import { useI18n } from '@open-pencil/vue'

import type { Variable } from '@open-pencil/core'

type BindingApi = {
  store: {
    resolveColorVariable: (id: string) => unknown
  }
  colorVariables: { value: Variable[] }
  filteredVariables: { value: Variable[] }
  searchTerm: { value: string }
  getBoundVariable: (nodeId: string, index: number) => Variable | undefined
  bindVariable: (nodeId: string, index: number, variableId: string) => void
  unbindVariable: (nodeId: string, index: number) => void
}

const { item, index, activeNodeId, bindingApi, visibilityTestId, unbindTestId } = defineProps<{
  item: { opacity: number; visible: boolean }
  index: number
  activeNodeId?: string | null
  bindingApi: BindingApi
  visibilityTestId: string
  unbindTestId?: string
}>()

const emit = defineEmits<{
  patch: [changes: Record<string, unknown>]
  toggleVisibility: []
  remove: []
}>()

const { panels, dialogs } = useI18n()
</script>

<template>
  <div class="group flex items-center gap-1.5 py-0.5">
    <div class="min-w-0 flex flex-1 items-center gap-1.5">
      <slot />
    </div>

    <ScrubInput
      class="w-12 shrink-0"
      suffix="%"
      :model-value="Math.round(item.opacity * 100)"
      :min="0"
      :max="100"
      @update:model-value="emit('patch', { opacity: Math.max(0, Math.min(1, $event / 100)) })"
    />

    <PopoverRoot
      v-if="
        activeNodeId &&
        bindingApi.colorVariables.value.length > 0 &&
        !bindingApi.getBoundVariable(activeNodeId, index)
      "
    >
      <Tip :label="panels.applyVariable">
        <PopoverTrigger
          class="shrink-0 cursor-pointer border-none bg-transparent p-0 text-muted hover:text-surface"
        >
          <icon-lucide-link class="size-3.5" />
        </PopoverTrigger>
      </Tip>
      <PopoverPortal>
        <PopoverContent
          side="left"
          :side-offset="8"
          class="z-50 w-56 rounded-lg border border-border bg-panel shadow-lg"
        >
          <ComboboxRoot
            @update:model-value="
              activeNodeId && bindingApi.bindVariable(activeNodeId, index, ($event as Variable).id)
            "
          >
            <ComboboxInput
              :model-value="bindingApi.searchTerm.value"
              :placeholder="dialogs.search"
              class="w-full border-b border-border bg-transparent px-2 py-1.5 text-[11px] text-surface outline-none placeholder:text-muted"
              @update:model-value="bindingApi.searchTerm.value = String($event)"
            />
            <ComboboxContent class="max-h-48 overflow-y-auto p-1">
              <ComboboxEmpty class="px-2 py-3 text-center text-[11px] text-muted">{{
                panels.noVariablesFound
              }}</ComboboxEmpty>
              <ComboboxItem
                v-for="v in bindingApi.filteredVariables.value"
                :key="v.id"
                :value="v"
                class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[11px] text-surface data-[highlighted]:bg-hover"
              >
                <div
                  class="size-3 shrink-0 rounded-sm border border-border"
                  :style="{
                    background: bindingApi.store.resolveColorVariable(v.id)
                      ? colorToCSS(bindingApi.store.resolveColorVariable(v.id) as never)
                      : '#000'
                  }"
                />
                <span class="min-w-0 flex-1 truncate">{{ v.name }}</span>
              </ComboboxItem>
            </ComboboxContent>
          </ComboboxRoot>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>

    <Tip
      v-else-if="activeNodeId && bindingApi.getBoundVariable(activeNodeId, index)"
      :label="panels.detachVariable"
    >
      <button tabindex="0"
        :data-test-id="unbindTestId"
        class="shrink-0 cursor-pointer border-none bg-transparent p-0 text-violet-400 hover:text-surface"
        @click="bindingApi.unbindVariable(activeNodeId, index)"
      >
        <icon-lucide-unlink class="size-3" />
      </button>
    </Tip>

    <button tabindex="0"
      :data-test-id="visibilityTestId"
      class="shrink-0 cursor-pointer border-none bg-transparent p-0 text-muted hover:text-surface"
      @click="emit('toggleVisibility')"
    >
      <icon-lucide-eye v-if="item.visible" class="size-3.5" />
      <icon-lucide-eye-off v-else class="size-3.5" />
    </button>

    <button tabindex="0" :class="useIconButtonUI({ ui: { base: 'shrink-0' } }).base" @click="emit('remove')">
      −
    </button>
  </div>
</template>
