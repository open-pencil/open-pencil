<script setup lang="ts">
import { computed, ref } from 'vue'

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
  createStates: []
}>()
const { panels, locale } = useI18n()
const labels = useBehaviourLabels()

type Row = { part: BehaviourPartControl } | { value: BehaviourValueControl }
const rowOf = (row: Row) => ('part' in row ? row.part : row.value)

/** A row comes first when the control needs it, uses it, or keeps its own settings. */
function first(row: BehaviourValueControl | BehaviourPartControl): boolean {
  return !('required' in row) || row.required || !!row.propertyId
}
/**
 * Whether a row belongs in the section. An unbound Disabled leaves its look to the states,
 * which add a Disabled variant, unless the component has a property to bind it to.
 */
function usable(row: BehaviourValueControl | BehaviourPartControl): boolean {
  if (row.id !== 'disabled' || !('options' in row) || row.propertyId) return true
  return row.options.length > 0 && !behaviour?.states.values.disabled
}
const rows = computed<Row[]>(() =>
  [
    ...(behaviour?.values.map((value) => ({ value })) ?? []),
    ...(behaviour?.parts.map((part) => ({ part })) ?? [])
  ].filter((row) => usable(rowOf(row)))
)
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

/** The name of a missing row: a part, the states, or a value. */
function missingName(control: BehaviourControl, id: string): string {
  if (control.parts.some((row) => row.id === id)) return labels.value.part(id)
  if (id === 'states') return panels.value.behaviourStates
  return labels.value.valueOf(control.kind, id)
}

/** What is left to bind, by row name, such as "Still needed: Track and Thumb." */
const nextStep = computed(() => {
  if (!behaviour) return ''
  const names = behaviour.missing.map((id) => missingName(behaviour, id))
  const list = new Intl.ListFormat(locale.value, { type: 'conjunction' }).format(names)
  return panels.value.behaviourNextStep({ names: list })
})
</script>

<template>
  <PanelSection :label="panels.behaviour" :empty="!behaviour">
    <template #actions>
      <AddBehaviourPicker v-if="!behaviour" @add="emit('add', $event)" />
      <IconButton v-else :label="panels.removeBehaviour" @click="emit('remove')">
        <icon-lucide-minus class="size-3.5" />
      </IconButton>
    </template>

    <div v-if="behaviour && kind" class="flex flex-col gap-2" data-property="behaviour">
      <div class="flex items-center gap-1.5 text-xs text-surface">
        <icon-lucide-mouse-pointer-click class="size-3.5 shrink-0 text-component" />
        <span class="min-w-0 flex-1 truncate font-medium">{{ kind.label }}</span>
        <span
          v-if="!behaviour.missing.length"
          class="flex h-5 shrink-0 items-center gap-1 rounded bg-panel-field px-1.5 text-[10px] text-muted"
        >
          <icon-lucide-check class="size-3 text-success" />
          {{ panels.behaviourComplete }}
        </span>
      </div>

      <p
        v-if="behaviour.missing.length"
        role="status"
        class="flex items-start gap-1.5 rounded bg-issue-warning/10 px-1.5 py-1 text-[11px] leading-4 text-issue-warning"
        data-property="behaviour-missing"
      >
        <SeverityIcon severity="warning" class="mt-0.5 shrink-0" />
        {{ nextStep }}
      </p>

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
        @create="emit('createStates')"
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
            @create="emit('createStates')"
          />
        </div>
      </AppCollapsible>
    </div>
  </PanelSection>
</template>
