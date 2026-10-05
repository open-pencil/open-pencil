<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import type { BehaviourKind, InteractionState } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'
import type {
  BehaviourControl,
  BehaviourNumberControl,
  BehaviourPartControl,
  BehaviourValueControl
} from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import SeverityIcon from '@/components/ui/feedback/SeverityIcon.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import AddBehaviourPicker from './AddBehaviourPicker.vue'
import BehaviourRow from './BehaviourRow.vue'
import BehaviourStates from './BehaviourStates.vue'
import { useBehaviourLabels } from './labels'

/**
 * The behaviour of the selected main component: which control it acts as, the properties that
 * hold its values, and the slots that are its parts. Rows it needs, or already uses, come
 * first; the optional rest folds under More options. An empty row offers to create what it
 * needs.
 */
const { behaviour } = defineProps<{ behaviour: BehaviourControl | null }>()
const emit = defineEmits<{
  add: [kind: BehaviourKind]
  remove: []
  bindValue: [valueId: string, propertyId: string]
  bindText: [valueId: string, propertyId: string]
  mapValue: [valueId: string, mapping: { on: string; off: string }]
  setNumber: [valueId: string, settings: Omit<BehaviourNumberControl, 'id' | 'type'>]
  bindPart: [partId: string, propertyId: string]
  bindStates: [propertyId: string]
  mapState: [state: InteractionState, value: string]
  createText: [valueId: string, name: string]
  createVariant: [valueId: string, name: string]
  createPart: [partId: string, name: string]
}>()
const { panels } = useI18n()
const labels = useBehaviourLabels()

type Row = { part: BehaviourPartControl } | { value: BehaviourValueControl }

/** A row comes first when the control needs it, uses it, or keeps its own settings. */
function first(row: BehaviourValueControl | BehaviourPartControl): boolean {
  return !('required' in row) || row.required || !!row.propertyId
}
const rows = computed<Row[]>(() => [
  ...(behaviour?.values.map((value) => ({ value })) ?? []),
  ...(behaviour?.parts.map((part) => ({ part })) ?? [])
])
const rowOf = (row: Row) => ('part' in row ? row.part : row.value)
const mainRows = computed(() => rows.value.filter((row) => first(rowOf(row))))
const moreRows = computed(() => rows.value.filter((row) => !first(rowOf(row))))
/** States come first once drawn, or when there is nothing else to set up, as on a button. */
const statesFirst = computed(
  () =>
    !!behaviour?.states.propertyId ||
    !rows.value.some((row) => {
      const control = rowOf(row)
      return 'required' in control && control.required
    })
)
const moreOpen = ref(false)

function bind(row: Row, propertyId: string) {
  if ('part' in row) emit('bindPart', row.part.id, propertyId)
  else if (row.value.type === 'text') emit('bindText', row.value.id, propertyId)
  else emit('bindValue', row.value.id, propertyId)
}

function create(row: Row, name: string) {
  if ('part' in row) emit('createPart', row.part.id, name)
  else if (row.value.type === 'text') emit('createText', row.value.id, name)
  else emit('createVariant', row.value.id, name)
}

const kind = computed(() => (behaviour ? labels.value.kind(behaviour.kind) : null))

/** What the missing chip says: the one row missing, or how many are. */
const missingLabel = computed(() => {
  const missing = behaviour?.missing ?? []
  const [only] = missing
  if (!behaviour || missing.length !== 1 || !only)
    return panels.value.behaviourMissingCount(missing.length)
  const isPart = behaviour.parts.some((row) => row.id === only)
  return panels.value.behaviourNeeds({
    name: isPart ? labels.value.part(only) : labels.value.valueOf(behaviour.kind, only)
  })
})

const root = useTemplateRef<HTMLElement>('root')
/** Bring the first missing row into view and focus its control. */
function showMissing() {
  const [missing] = behaviour?.missing ?? []
  const row = missing ? root.value?.querySelector<HTMLElement>(`[data-row="${missing}"]`) : null
  row?.scrollIntoView({ block: 'nearest' })
  row?.querySelector<HTMLElement>('button, input')?.focus()
}
</script>

<template>
  <PanelSection :label="panels.behaviour" :empty="!behaviour">
    <template #actions>
      <AddBehaviourPicker v-if="!behaviour" @add="emit('add', $event)" />
      <IconButton v-else :label="panels.removeBehaviour" @click="emit('remove')">
        <icon-lucide-minus class="size-3.5" />
      </IconButton>
    </template>

    <div v-if="behaviour && kind" ref="root" class="flex flex-col gap-2" data-property="behaviour">
      <div class="flex items-center gap-1.5 text-xs text-surface">
        <icon-lucide-mouse-pointer-click class="size-3.5 shrink-0 text-component" />
        <span class="min-w-0 flex-1 truncate font-medium">{{ kind.label }}</span>
        <button
          v-if="behaviour.missing.length"
          type="button"
          class="flex h-5 shrink-0 items-center gap-1 rounded bg-issue-warning/15 px-1.5 text-[10px] text-issue-warning hover:bg-issue-warning/25"
          data-property="behaviour-missing"
          @click="showMissing"
        >
          <SeverityIcon severity="warning" />
          {{ missingLabel }}
        </button>
        <span
          v-else
          class="flex h-5 shrink-0 items-center gap-1 rounded bg-panel-field px-1.5 text-[10px] text-muted"
        >
          <icon-lucide-check class="size-3 text-success" />
          {{ panels.behaviourComplete }}
        </span>
      </div>

      <BehaviourRow
        v-for="row in mainRows"
        :key="rowOf(row).id"
        :kind="behaviour.kind"
        :row="row"
        @bind="bind(row, $event)"
        @create="create(row, $event)"
        @map-value="emit('mapValue', rowOf(row).id, $event)"
        @set-number="emit('setNumber', rowOf(row).id, $event)"
      />
      <BehaviourStates
        v-if="statesFirst"
        :states="behaviour.states"
        @bind="emit('bindStates', $event)"
        @map="(state, value) => emit('mapState', state, value)"
      />

      <AppCollapsible
        v-if="moreRows.length || !statesFirst"
        v-model:open="moreOpen"
        :label="panels.behaviourMoreOptions"
        :ui="{ trigger: 'text-[11px] text-muted hover:text-surface', icon: 'size-3' }"
        data-property="behaviour-more"
      >
        <div class="flex flex-col gap-2 pt-2">
          <BehaviourRow
            v-for="row in moreRows"
            :key="rowOf(row).id"
            :kind="behaviour.kind"
            :row="row"
            @bind="bind(row, $event)"
            @create="create(row, $event)"
            @map-value="emit('mapValue', rowOf(row).id, $event)"
          />
          <BehaviourStates
            v-if="!statesFirst"
            :states="behaviour.states"
            @bind="emit('bindStates', $event)"
            @map="(state, value) => emit('mapState', state, value)"
          />
        </div>
      </AppCollapsible>
    </div>
  </PanelSection>
</template>
