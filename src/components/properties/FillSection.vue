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
import { useNodeProps } from '@/composables/use-node-props'
import { useMultiProps } from '@/composables/use-multi-props'
import { DEFAULT_SHAPE_FILL } from '@/constants'
import { colorToCSS, colorToHexRaw } from '@open-pencil/core'
import type { Fill, Variable, Color } from '@open-pencil/core'

const { store } = useNodeProps()
const {
  nodes,
  isMulti,
  active,
  activeNode,
  targetNodes,
  isArrayMixed,
  updateArrayItem,
  removeArrayItem,
  toggleArrayVisibility
} = useMultiProps()

const fillsAreMixed = computed(() => isArrayMixed('fills'))

const colorVariables = computed(() => store.graph.getVariablesByType('COLOR'))

function getBoundVariable(index: number): Variable | undefined {
  const n = activeNode.value
  if (!n) return undefined
  const varId = n.boundVariables[`fills/${index}/color`]
  return varId ? store.graph.variables.get(varId) : undefined
}

function bindVariable(index: number, variableId: string) {
  const n = activeNode.value
  if (!n) return
  store.graph.bindVariable(n.id, `fills/${index}/color`, variableId)
  store.requestRender()
}

function unbindVariable(index: number) {
  const n = activeNode.value
  if (!n) return
  store.graph.unbindVariable(n.id, `fills/${index}/color`)
  store.requestRender()
}

function resolvedSwatchStyle(variable: Variable): string {
  const color = store.graph.resolveColorVariable(variable.id)
  if (!color) return 'background: #000'
  return `background: ${colorToCSS(color)}`
}

function updateFill(index: number, fill: Fill) {
  updateArrayItem('fills', index, fill, 'Change fill')
}

function updateOpacity(index: number, opacity: number) {
  updateArrayItem(
    'fills',
    index,
    { opacity: Math.max(0, Math.min(1, opacity / 100)) },
    'Change fill'
  )
}

function toggleVisibility(index: number) {
  toggleArrayVisibility('fills', index)
}

function add() {
  for (const n of targetNodes()) {
    const fills = isMulti.value
      ? [{ ...DEFAULT_SHAPE_FILL }]
      : [...n.fills, { ...DEFAULT_SHAPE_FILL }]
    store.updateNodeWithUndo(n.id, { fills }, isMulti.value ? 'Set fill' : 'Add fill')
  }
}

function remove(index: number) {
  removeArrayItem('fills', index, 'Remove fill')
}

const searchTerm = ref('')
const { contains } = useFilter({ sensitivity: 'base' })
const filteredVariables = computed(() => {
  if (!searchTerm.value) return colorVariables.value
  return colorVariables.value.filter((v) => contains(v.name, searchTerm.value))
})
</script>

<template>
  <div v-if="active" data-test-id="fill-section" class="border-b border-border px-3 py-2">
    <div class="flex items-center justify-between">
      <label class="mb-1 block text-[11px] text-muted">Fill</label>
      <button
        data-test-id="fill-section-add"
        class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm leading-none text-muted hover:bg-hover hover:text-surface"
        @click="add"
      >
        +
      </button>
    </div>
    <p v-if="fillsAreMixed" class="text-[11px] text-muted">Click + to replace mixed fills</p>
    <div
      v-for="(fill, i) in fillsAreMixed ? [] : (activeNode?.fills ?? [])"
      :key="i"
      data-test-id="fill-item"
      :data-test-index="i"
      class="group flex items-center gap-1.5 py-0.5"
    >
      <FillPicker :fill="fill" @update="updateFill(i, $event)" />

      <!-- Bound variable indicator or hex value -->
      <template v-if="getBoundVariable(i)">
        <span
          class="min-w-0 flex-1 truncate rounded bg-violet-500/10 px-1 font-mono text-xs text-violet-400"
        >
          {{ getBoundVariable(i)!.name }}
        </span>
        <button
          data-test-id="fill-unbind-variable"
          class="cursor-pointer border-none bg-transparent p-0 text-violet-400 hover:text-surface"
          title="Detach variable"
          @click="unbindVariable(i)"
        >
          <icon-lucide-unlink class="size-3" />
        </button>
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
        @update:model-value="updateOpacity(i, $event)"
      />

      <!-- Variable picker -->
      <PopoverRoot
        v-if="colorVariables.length > 0 && fill.type === 'SOLID' && !getBoundVariable(i)"
      >
        <PopoverTrigger
          class="cursor-pointer border-none bg-transparent p-0 text-muted hover:text-surface"
          title="Apply variable"
        >
          <icon-lucide-link class="size-3.5" />
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            side="left"
            :side-offset="8"
            class="z-50 w-56 rounded-lg border border-border bg-panel shadow-lg"
          >
            <ComboboxRoot @update:model-value="bindVariable(i, ($event as Variable).id)">
              <ComboboxInput
                v-model="searchTerm"
                placeholder="Search variables…"
                class="w-full border-b border-border bg-transparent px-2 py-1.5 text-[11px] text-surface outline-none placeholder:text-muted"
              />
              <ComboboxContent class="max-h-48 overflow-y-auto p-1">
                <ComboboxEmpty class="px-2 py-3 text-center text-[11px] text-muted">
                  No variables found
                </ComboboxEmpty>
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
      <button
        class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm leading-none text-muted hover:bg-hover hover:text-surface"
        @click="remove(i)"
      >
        −
      </button>
    </div>
  </div>
</template>
