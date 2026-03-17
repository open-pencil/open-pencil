<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
  ComboboxRoot,
  ComboboxInput,
  ComboboxContent,
  ComboboxItem,
  ComboboxEmpty,
  useFilter
} from 'reka-ui'

import FillPicker from '@/components/FillPicker.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import Tip from '@/components/Tip.vue'
import { iconButton } from '@/components/ui/icon-button'
import { sectionLabel, sectionWrapper } from '@/components/ui/section'
import { PropertyListRoot, useEditor } from '@open-pencil/vue'
import { DEFAULT_SHAPE_FILL } from '@/constants'
import { colorToCSS, colorToHexRaw } from '@open-pencil/core'

import type { Fill, Variable } from '@open-pencil/core'

const store = useEditor()

const colorVariables = computed(() => store.getVariablesByType('COLOR'))

function getBoundVariable(nodeId: string, index: number): Variable | undefined {
  const n = store.getNode(nodeId)
  if (!n) return undefined
  const varId = n.boundVariables[`fills/${index}/color`]
  return varId ? store.getVariable(varId) : undefined
}

function bindFillVariable(nodeId: string, index: number, variableId: string) {
  store.bindVariable(nodeId, `fills/${index}/color`, variableId)
}

function unbindFillVariable(nodeId: string, index: number) {
  store.unbindVariable(nodeId, `fills/${index}/color`)
}

function resolvedSwatchStyle(variable: Variable): string {
  const color = store.resolveColorVariable(variable.id)
  if (!color) return 'background: #000'
  return `background: ${colorToCSS(color)}`
}

const searchTerm = ref('')
const { contains } = useFilter({ sensitivity: 'base' })
const filteredVariables = computed(() => {
  if (!searchTerm.value) return colorVariables.value
  return colorVariables.value.filter((v) => contains(v.name, searchTerm.value))
})
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, add, remove, update, patch, toggleVisibility }"
    prop-key="fills"
    label="Fill"
  >
    <div data-test-id="fill-section" :class="sectionWrapper()">
      <div class="flex items-center justify-between">
        <label :class="sectionLabel()">Fill</label>
        <button
          data-test-id="fill-section-add"
          :class="iconButton()"
          @click="add({ ...DEFAULT_SHAPE_FILL })"
        >
          +
        </button>
      </div>
      <p v-if="isMixed" class="text-[11px] text-muted">Click + to replace mixed fills</p>
      <div
        v-for="(fill, i) in items as Fill[]"
        :key="i"
        data-test-id="fill-item"
        :data-test-index="i"
        class="group flex items-center gap-1.5 py-0.5"
      >
        <FillPicker :fill="fill" @update="update(i, $event)" />

        <template v-if="activeNode && getBoundVariable(activeNode.id, i)">
          <span
            class="min-w-0 flex-1 truncate rounded bg-violet-500/10 px-1 font-mono text-xs text-violet-400"
          >
            {{ getBoundVariable(activeNode.id, i)!.name }}
          </span>
          <Tip label="Detach variable">
            <button
              data-test-id="fill-unbind-variable"
              class="cursor-pointer border-none bg-transparent p-0 text-violet-400 hover:text-surface"
              @click="unbindFillVariable(activeNode.id, i)"
            >
              <icon-lucide-unlink class="size-3" />
            </button>
          </Tip>
        </template>
        <template v-else>
          <span class="min-w-0 flex-1 font-mono text-xs text-surface">
            <template v-if="fill.type === 'SOLID'">{{ colorToHexRaw(fill.color) }}</template>
            <template v-else-if="fill.type.startsWith('GRADIENT')">{{
              fill.type.replace('GRADIENT_', '')
            }}</template>
            <template v-else>{{ fill.type }}</template>
          </span>
        </template>

        <ScrubInput
          class="w-12"
          suffix="%"
          :model-value="Math.round(fill.opacity * 100)"
          :min="0"
          :max="100"
          @update:model-value="patch(i, { opacity: Math.max(0, Math.min(1, $event / 100)) })"
        />

        <PopoverRoot
          v-if="
            colorVariables.length > 0 &&
            fill.type === 'SOLID' &&
            activeNode &&
            !getBoundVariable(activeNode.id, i)
          "
        >
          <Tip label="Apply variable">
            <PopoverTrigger
              class="cursor-pointer border-none bg-transparent p-0 text-muted hover:text-surface"
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
                  activeNode && bindFillVariable(activeNode.id, i, ($event as Variable).id)
                "
              >
                <ComboboxInput
                  v-model="searchTerm"
                  placeholder="Search variables…"
                  class="w-full border-b border-border bg-transparent px-2 py-1.5 text-[11px] text-surface outline-none placeholder:text-muted"
                />
                <ComboboxContent class="max-h-48 overflow-y-auto p-1">
                  <ComboboxEmpty class="px-2 py-3 text-center text-[11px] text-muted"
                    >No variables found</ComboboxEmpty
                  >
                  <ComboboxItem
                    v-for="v in filteredVariables"
                    :key="v.id"
                    :value="v"
                    class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[11px] text-surface data-[highlighted]:bg-hover"
                  >
                    <div
                      class="size-3 shrink-0 rounded-sm border border-border"
                      :style="resolvedSwatchStyle(v)"
                    />
                    <span class="min-w-0 flex-1 truncate">{{ v.name }}</span>
                  </ComboboxItem>
                </ComboboxContent>
              </ComboboxRoot>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>

        <button
          class="cursor-pointer border-none bg-transparent p-0 text-muted hover:text-surface"
          @click="toggleVisibility(i)"
        >
          <icon-lucide-eye v-if="fill.visible" class="size-3.5" />
          <icon-lucide-eye-off v-else class="size-3.5" />
        </button>
        <button :class="iconButton()" @click="remove(i)">−</button>
      </div>
    </div>
  </PropertyListRoot>
</template>
