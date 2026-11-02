import { isEqual } from 'es-toolkit'
import { computed, shallowRef, watch } from 'vue'

import { parseColor } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { randomHex } from '@open-pencil/scene-graph/random'
import {
  STATUS_WORKFLOW_PRESETS,
  statusWorkflowImpact,
  type StatusState,
  type StatusWorkflow,
  type StatusWorkflowPreset
} from '@open-pencil/scene-graph/statuses'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import { useEditorStore } from '@/app/editor/active-store'

/** Colors a new status takes in turn, the presets' own and a few more. */
export const STATUS_COLORS: readonly Color[] = [
  '#b3b3b3',
  '#0d99ff',
  '#9747ff',
  '#14ae5c',
  '#ffcd29',
  '#ff8c1a',
  '#f24822',
  '#ff24bd'
].map(parseColor)

const PRESETS = Object.keys(STATUS_WORKFLOW_PRESETS) as StatusWorkflowPreset[]

/** The preset `states` are exactly, if any. */
function presetOf(states: readonly StatusState[]): StatusWorkflowPreset | undefined {
  return PRESETS.find((preset) => isEqual(STATUS_WORKFLOW_PRESETS[preset].states, states))
}

/**
 * The Statuses dialog's draft of the document's statuses. Edits stay in the draft, which shows
 * what applying it would do to the layers that have statuses; Apply commits the whole draft as
 * one undo step, and a state layers use is deleted only once they have somewhere to go.
 */
export function useStatusWorkflowDraft() {
  const store = useEditorStore()
  const current = useSceneComputed(() => store.statusWorkflow())
  /** The statuses the draft started from; edits are what differs from them. */
  const base = shallowRef<StatusState[]>(current.value.states)
  // Shallow: every edit replaces the list, so its states stay plain objects structuredClone copies.
  const draft = shallowRef<StatusState[]>(structuredClone(current.value.states))
  /** Deleted states layers use, with where those layers go: a state, none, or not chosen yet. */
  const removals = shallowRef<Record<string, string | null | undefined>>({})

  /** How many layers have each state, hidden ones included, across every page. */
  const usage = useSceneComputed(() => {
    const counts = new Map<string, number>()
    for (const node of store.graph.getAllNodes()) {
      if (node.status) counts.set(node.status, (counts.get(node.status) ?? 0) + 1)
    }
    return counts
  })

  const dirty = computed(
    () => !isEqual(draft.value, base.value) || Object.keys(removals.value).length > 0
  )
  const removed = computed(() =>
    current.value.states.filter((state) => Object.hasOwn(removals.value, state.id))
  )
  const unresolved = computed(() =>
    removed.value.filter((state) => removals.value[state.id] === undefined)
  )
  const moves = computed(() => {
    const result: Record<string, string | null> = {}
    for (const [id, target] of Object.entries(removals.value)) {
      if (target !== undefined) result[id] = target
    }
    return result
  })
  const next = computed<StatusWorkflow>(() => {
    const preset = presetOf(draft.value)
    return preset ? { preset, states: draft.value } : { states: draft.value }
  })
  const impact = useSceneComputed(() =>
    dirty.value ? statusWorkflowImpact(store.graph, current.value, next.value, moves.value) : []
  )

  function reset() {
    base.value = current.value.states
    draft.value = structuredClone(current.value.states)
    removals.value = {}
  }

  // Undo, redo, or another person's edit replace the statuses; a draft nobody touched follows.
  watch(current, () => {
    if (!dirty.value) reset()
  })

  function update(id: string, changes: Partial<Omit<StatusState, 'id'>>) {
    draft.value = draft.value.map((state) => (state.id === id ? { ...state, ...changes } : state))
  }

  function rename(id: string, name: string) {
    const trimmed = name.trim()
    if (trimmed) update(id, { name: trimmed })
  }

  function setColor(id: string, color: Color) {
    update(id, { color })
  }

  function add(name: string) {
    const color = STATUS_COLORS[draft.value.length % STATUS_COLORS.length] ?? STATUS_COLORS[0]
    draft.value = [...draft.value, { id: `s_${randomHex(8)}`, name, color }]
  }

  function remove(id: string) {
    if (draft.value.length < 2) return
    draft.value = draft.value.filter((state) => state.id !== id)
    if (usage.value.has(id)) removals.value = { ...removals.value, [id]: undefined }
  }

  /** Sends the layers in a deleted state to `target`, or clears theirs with null. */
  function chooseReplacement(id: string, target: string | null) {
    removals.value = { ...removals.value, [id]: target }
  }

  /** Brings a deleted state back where it was. */
  function restore(id: string) {
    const state = current.value.states.find((entry) => entry.id === id)
    if (!state) return
    const states = [...draft.value]
    states.splice(Math.min(current.value.states.indexOf(state), states.length), 0, state)
    draft.value = states
    removals.value = Object.fromEntries(
      Object.entries(removals.value).filter(([removedId]) => removedId !== id)
    )
  }

  function reorder(id: string, index: number) {
    const moved = draft.value.find((state) => state.id === id)
    if (!moved) return
    const states = draft.value.filter((state) => state.id !== id)
    states.splice(index, 0, moved)
    draft.value = states
  }

  /** Starts the draft from a preset; states layers use that it lacks wait for a destination. */
  function applyPreset(preset: StatusWorkflowPreset) {
    const states = structuredClone(STATUS_WORKFLOW_PRESETS[preset].states)
    const kept = new Set(states.map((state) => state.id))
    const pending: Record<string, string | null | undefined> = {}
    for (const id of usage.value.keys()) {
      if (!kept.has(id)) pending[id] = removals.value[id]
    }
    draft.value = states
    removals.value = pending
  }

  /** Commits the draft as one undo step. False while a deleted state's layers have nowhere to go. */
  function apply(): boolean {
    if (unresolved.value.length > 0) return false
    const states = structuredClone(draft.value)
    const preset = presetOf(states)
    store.setStatusWorkflow(preset ? { preset, states } : { states }, { ...moves.value })
    reset()
    return true
  }

  return {
    draft,
    preset: computed(() => presetOf(draft.value)),
    usage,
    dirty,
    removed,
    removals,
    unresolved,
    impact,
    rename,
    setColor,
    add,
    remove,
    chooseReplacement,
    restore,
    reorder,
    applyPreset,
    apply,
    reset
  }
}
