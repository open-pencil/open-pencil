<script setup lang="ts">
import { ListboxContent, ListboxGroup, ListboxGroupLabel, ListboxItem, ListboxRoot } from 'reka-ui'
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

/** Listbox selects with click, Enter, or Space, and toggles a selected row off again. */
const selection = computed({
  get: () => selectedId.value ?? undefined,
  set: (value: string | undefined) => {
    selectedId.value = value ?? null
  }
})

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
  <ListboxRoot
    v-model="selection"
    :class="ui.list()"
    highlight-on-hover
    :aria-label="collection.name"
    data-test-id="token-list"
  >
    <div :class="ui.header()" :style="columns" aria-hidden="true">
      <span>{{ labels.name }}</span>
      <span v-if="!stacked">{{ labels.cssName }}</span>
      <span v-for="mode in modes" :key="mode.modeId" :class="ui.modeHeader()">
        <span class="text-surface">{{ mode.name }}</span>
        <span v-if="condition(mode.modeId)" :class="ui.modeCondition()">
          {{ condition(mode.modeId) }}
        </span>
      </span>
    </div>
    <ListboxContent>
      <ListboxGroup v-for="group in groups" :key="group.path">
        <ListboxGroupLabel v-if="group.path" :class="ui.group()">{{
          group.path
        }}</ListboxGroupLabel>
        <ListboxItem
          v-for="row in group.rows"
          :key="row.variable.id"
          :value="row.variable.id"
          :class="ui.row()"
          :style="columns"
          data-test-id="variable-row"
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
        </ListboxItem>
      </ListboxGroup>
    </ListboxContent>
  </ListboxRoot>
</template>
