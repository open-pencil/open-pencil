<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { VariableCollection } from '@open-pencil/scene-graph'

import { modeConditionPlaceholder, type TokenGroup } from '@/app/editor/tokens/model'
import BindingPill from '@/components/ui/binding/BindingPill.vue'
import FillSwatch from '@/components/ui/paint/FillSwatch.vue'
import tokensPanelTheme from '@/theme/tokens-panel'

const {
  collection,
  groups,
  labels,
  modeIds,
  stacked = false
} = defineProps<{
  collection: VariableCollection
  groups: TokenGroup[]
  labels: { name: string; cssName: string }
  /** Modes to show values for; every mode by default. */
  modeIds?: readonly string[]
  /** One column for the name with the CSS name under it, for narrow screens. */
  stacked?: boolean
}>()
const selectedId = defineModel<string | null>('selectedId', { default: null })

const ui = tv(tokensPanelTheme)()

const modes = computed(() =>
  modeIds ? collection.modes.filter((mode) => modeIds.includes(mode.modeId)) : collection.modes
)

const columns = computed(() => {
  const values = `repeat(${modes.value.length}, minmax(${stacked ? '6rem' : '8rem'}, 1fr))`
  return {
    gridTemplateColumns: stacked
      ? `minmax(0, 1.4fr) ${values}`
      : `minmax(9rem, 1.1fr) minmax(9rem, 1fr) ${values}`
  }
})

function condition(modeId: string) {
  const mode = collection.modes.find((candidate) => candidate.modeId === modeId)
  return mode?.condition ?? modeConditionPlaceholder(collection, modeId)
}

function shown<T extends { modeId: string }>(values: readonly T[]) {
  return values.filter((value) => modes.value.some((mode) => mode.modeId === value.modeId))
}
</script>

<template>
  <div :class="ui.list()" role="grid" :aria-label="collection.name">
    <div :class="ui.header()" :style="columns" role="row">
      <span role="columnheader">{{ labels.name }}</span>
      <span v-if="!stacked" role="columnheader">{{ labels.cssName }}</span>
      <span v-for="mode in modes" :key="mode.modeId" :class="ui.modeHeader()" role="columnheader">
        <span class="text-surface">{{ mode.name }}</span>
        <span v-if="condition(mode.modeId)" :class="ui.modeCondition()">
          {{ condition(mode.modeId) }}
        </span>
      </span>
    </div>
    <template v-for="group in groups" :key="group.path">
      <div v-if="group.path" :class="ui.group()">{{ group.path }}</div>
      <div
        v-for="row in group.rows"
        :key="row.variable.id"
        :class="ui.row()"
        :style="columns"
        :data-selected="selectedId === row.variable.id || undefined"
        data-test-id="variable-row"
        role="row"
        @click="selectedId = row.variable.id"
      >
        <span :class="ui.name()">
          <span class="truncate">{{ row.label }}</span>
          <span v-if="stacked" :class="ui.cssName()">--{{ row.cssName }}</span>
        </span>
        <span v-if="!stacked" :class="ui.cssName()">--{{ row.cssName }}</span>
        <span v-for="value in shown(row.values)" :key="value.modeId" :class="ui.value()">
          <FillSwatch
            v-if="value.color"
            :fill="{ type: 'SOLID', visible: true, opacity: value.color.a, color: value.color }"
            :ui="{ root: 'size-3.5 shrink-0 rounded-sm' }"
          />
          <span v-if="value.expression" :class="ui.expression()">{{ value.expression }}</span>
          <BindingPill v-else-if="value.alias" :label="value.alias" />
          <span v-else class="truncate">{{ value.css }}</span>
        </span>
      </div>
    </template>
  </div>
</template>
