<script setup lang="ts">
import { computed } from 'vue'
import { useI18n, useLayoutControlsContext, useSceneComputed } from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import IconButton from '@/components/ui/IconButton.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import Tip from '@/components/ui/Tip.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelItemRow from '@/components/ui/panel/PanelItemRow.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import type { LayoutGrid } from '@open-pencil/scene-graph'

const ctx = useLayoutControlsContext()
const { panels } = useI18n()

const selectedNode = useSceneComputed(() => ctx.editor.getSelectedNode() ?? null)
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
  ctx.editor.updateNodeWithUndo(node.id, { layoutGrids: next }, label)
}

function add() {
  commit([...grids.value, defaultGrid()], 'Add layout grid')
}

function remove(index: number) {
  commit(
    grids.value.filter((_, i) => i !== index),
    'Remove layout grid'
  )
}

function patch(index: number, changes: Partial<LayoutGrid>, label = 'Edit layout grid') {
  commit(
    grids.value.map((grid, i) => (i === index ? { ...grid, ...changes } : grid)),
    label
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
            <Tip :label="option.label" class="flex items-center justify-center">
              <icon-lucide-columns-3 v-if="option.value === 'COLUMNS'" class="size-3.5" />
              <icon-lucide-rows-3 v-else-if="option.value === 'ROWS'" class="size-3.5" />
              <icon-lucide-layout-grid v-else class="size-3.5" />
            </Tip>
          </template>
        </SegmentedControl>
        <PanelGrid columns="two">
          <PanelFieldGroup :label="panels.gridCount">
            <NumberField
              :model-value="grid.count ?? grid.numSections ?? 1"
              :min="1"
              :aria-label="panels.gridCount"
              @update:model-value="patch(index, { count: $event })"
            />
          </PanelFieldGroup>
          <PanelFieldGroup v-if="!isGrid(grid)" :label="panels.gridGutter">
            <NumberField
              :model-value="grid.gutterSize ?? 0"
              :min="0"
              :aria-label="panels.gridGutter"
              @update:model-value="patch(index, { gutterSize: $event })"
            />
          </PanelFieldGroup>
          <PanelFieldGroup v-if="isGrid(grid)" :label="panels.gridSectionSize">
            <NumberField
              :model-value="grid.sectionSize ?? 0"
              :min="1"
              :aria-label="panels.gridSectionSize"
              @update:model-value="patch(index, { sectionSize: $event })"
            />
          </PanelFieldGroup>
          <PanelFieldGroup :label="panels.gridMargin">
            <NumberField
              :model-value="grid.offset ?? 0"
              :aria-label="panels.gridMargin"
              @update:model-value="patch(index, { offset: $event })"
            />
          </PanelFieldGroup>
        </PanelGrid>
      </div>
      <template #rail>
        <IconButton
          :label="panels.toggleVisibility"
          :active="grid.visible === false"
          @click="patch(index, { visible: grid.visible === false }, 'Toggle layout grid')"
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
