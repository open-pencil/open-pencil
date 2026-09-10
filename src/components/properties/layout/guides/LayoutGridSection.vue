<script setup lang="ts">
import { computed } from 'vue'

import type { LayoutGrid } from '@open-pencil/scene-graph'
import { useEditor, useI18n, useSceneComputed } from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import SharedStyleField from '@/components/properties/shared-style/SharedStyleField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelItemRow from '@/components/ui/panel/PanelItemRow.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

const editor = useEditor()
const { panels } = useI18n()

const selectedNode = useSceneComputed(() => editor.getSelectedNode() ?? null)
const grids = computed<LayoutGrid[]>(() => selectedNode.value?.layoutGrids ?? [])

const patternOptions = computed(() => [
  { value: 'COLUMNS' as const, label: panels.value.gridColumns },
  { value: 'ROWS' as const, label: panels.value.gridRows },
  { value: 'GRID' as const, label: panels.value.gridGrid }
])

function defaultGrid(): LayoutGrid {
  return {
    visible: true,
    color: { r: 1, g: 0, b: 0, a: 0.1 },
    pattern: 'COLUMNS',
    alignment: 'STRETCH',
    count: 5,
    gutterSize: 20,
    offset: 0,
    sectionSize: 0
  }
}

function commit(next: LayoutGrid[], label: string) {
  const node = selectedNode.value
  if (!node) return
  editor.updateNodeWithUndo(node.id, { layoutGrids: next }, label)
}

function add() {
  commit([...grids.value, defaultGrid()], 'Add layout guide')
}

function remove(index: number) {
  commit(
    grids.value.filter((_, i) => i !== index),
    'Remove layout guide'
  )
}

function patch(index: number, changes: Partial<LayoutGrid>, label = 'Edit layout guide') {
  commit(
    grids.value.map((grid, i) => (i === index ? { ...grid, ...changes } : grid)),
    label
  )
}

type NumericGridField = 'count' | 'gutterSize' | 'sectionSize' | 'offset'

function updateNumber(index: number, key: NumericGridField, value: number) {
  const node = selectedNode.value
  if (!node) return
  editor.updateNode(node.id, {
    layoutGrids: grids.value.map((grid, i) => (i === index ? { ...grid, [key]: value } : grid))
  })
}

function commitNumber(index: number, key: NumericGridField, previous: number) {
  const node = selectedNode.value
  if (!node) return
  editor.commitNodeUpdate(
    node.id,
    {
      layoutGrids: grids.value.map((grid, i) => (i === index ? { ...grid, [key]: previous } : grid))
    },
    'Edit layout guide'
  )
}

function gridPattern(grid: LayoutGrid): 'COLUMNS' | 'ROWS' | 'GRID' {
  if (grid.pattern) return grid.pattern
  return grid.axis === 'Y' ? 'ROWS' : 'COLUMNS'
}

function isGrid(grid: LayoutGrid): boolean {
  return gridPattern(grid) === 'GRID'
}
</script>

<template>
  <PanelSection :label="panels.layoutGrids" :empty="grids.length === 0">
    <SharedStyleField kind="grid" :label="panels.gridStyle" />
    <template #actions>
      <IconButton :label="panels.addLayoutGrid" @click="add">
        <icon-lucide-plus class="size-3.5" />
      </IconButton>
    </template>

    <PanelItemRow v-for="(grid, index) in grids" :key="index" class="items-start">
      <div class="flex min-w-0 flex-1 flex-col gap-1.5">
        <SegmentedControl
          :model-value="gridPattern(grid)"
          :options="patternOptions"
          :label="panels.layoutGrids"
          @change="
            patch(index, { pattern: $event as LayoutGrid['pattern'] }, 'Change grid pattern')
          "
        >
          <template #option="{ option }">
            <Tip :label="option.label">
              <span class="flex items-center justify-center">
                <icon-lucide-columns-3 v-if="option.value === 'COLUMNS'" class="size-3.5" />
                <icon-lucide-rows-3 v-else-if="option.value === 'ROWS'" class="size-3.5" />
                <icon-lucide-layout-grid v-else class="size-3.5" />
              </span>
            </Tip>
          </template>
        </SegmentedControl>
        <PanelGrid :columns="2">
          <PanelFieldGroup :label="panels.gridCount">
            <NumberField
              :model-value="grid.count ?? grid.numSections ?? 1"
              :min="1"
              :aria-label="panels.gridCount"
              @update:model-value="updateNumber(index, 'count', $event)"
              @commit="(_value, previous) => commitNumber(index, 'count', previous)"
            />
          </PanelFieldGroup>
          <PanelFieldGroup v-if="!isGrid(grid)" :label="panels.gridGutter">
            <NumberField
              :model-value="grid.gutterSize ?? 0"
              :min="0"
              :aria-label="panels.gridGutter"
              @update:model-value="updateNumber(index, 'gutterSize', $event)"
              @commit="(_value, previous) => commitNumber(index, 'gutterSize', previous)"
            />
          </PanelFieldGroup>
          <PanelFieldGroup v-if="isGrid(grid)" :label="panels.gridSectionSize">
            <NumberField
              :model-value="grid.sectionSize ?? 0"
              :min="1"
              :aria-label="panels.gridSectionSize"
              @update:model-value="updateNumber(index, 'sectionSize', $event)"
              @commit="(_value, previous) => commitNumber(index, 'sectionSize', previous)"
            />
          </PanelFieldGroup>
          <PanelFieldGroup :label="panels.gridMargin">
            <NumberField
              :model-value="grid.offset ?? 0"
              :aria-label="panels.gridMargin"
              @update:model-value="updateNumber(index, 'offset', $event)"
              @commit="(_value, previous) => commitNumber(index, 'offset', previous)"
            />
          </PanelFieldGroup>
        </PanelGrid>
      </div>
      <template #rail>
        <IconButton
          :label="panels.toggleVisibility"
          :active="grid.visible === false"
          @click="patch(index, { visible: grid.visible === false }, 'Toggle layout guide')"
        >
          <icon-lucide-eye-off v-if="grid.visible === false" class="size-3.5" />
          <icon-lucide-eye v-else class="size-3.5" />
        </IconButton>
        <IconButton :label="panels.removeLayoutGrid" @click="remove(index)">
          <icon-lucide-minus class="size-3.5" />
        </IconButton>
      </template>
    </PanelItemRow>
  </PanelSection>
</template>
