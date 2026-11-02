<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch, type ComponentPublicInstance } from 'vue'

import type { StatusWorkflowPreset } from '@open-pencil/scene-graph/statuses'
import { useCommonMessages, useStatusMessages } from '@open-pencil/vue/i18n'
import { useFlatReorderDrag } from '@open-pencil/vue/shared/drag'

import { useEditorStore } from '@/app/editor/active-store'
import { useStatusWorkflowDraft } from '@/app/editor/statuses/workflow'
import { useDocumentShortcuts } from '@/app/shell/keyboard/document'
import StatusDot from '@/components/statuses/StatusDot.vue'
import StatusStateRow from '@/components/statuses/StatusStateRow.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'
import AppDialog from '@/components/ui/dialog/AppDialog.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import { statusRows } from './ui'

/**
 * The document's statuses: their order, colors, names, categories, and what editing does to each.
 * Changes stay a draft that says what it would do to the layers with statuses until Apply, which
 * is one undo step; undo works from inside the dialog.
 */
const store = useEditorStore()
const messages = useStatusMessages()
const common = useCommonMessages()
const onKeydown = useDocumentShortcuts()
const editor = useStatusWorkflowDraft()
const rows = statusRows()
const { draft, preset, usage, dirty, removed, removals, unresolved, impact } = editor
const newName = ref('')
const confirmingDiscard = ref(false)

const open = computed({
  get: () => store.state.statusesOpen,
  set: (value: boolean) => {
    if (!value && dirty.value) {
      confirmingDiscard.value = true
      return
    }
    store.state.statusesOpen = value
  }
})

/** Discarded edits are dropped as the dialog next opens, so its closing animation keeps them. */
let discarded = false

// A draft opens on the document's statuses as they are now, unless it holds edits not applied.
watch(open, (value) => {
  if (!value || (dirty.value && !discarded)) return
  discarded = false
  editor.reset()
})

/** The preset menu's value while the statuses match no preset. */
const CUSTOM = 'custom'
/** A replacement menu's value for clearing the layers' status; state ids never take it. */
const NO_STATUS = 'none'

const PRESET_LABELS = {
  handoff: 'presetHandoff',
  simple: 'presetSimple',
  review: 'presetReview'
} as const satisfies Record<StatusWorkflowPreset, keyof typeof messages.value>
const PRESETS = Object.keys(PRESET_LABELS) as StatusWorkflowPreset[]

const presetOptions = computed(() => [
  { value: CUSTOM, label: messages.value.custom, disabled: true },
  ...PRESETS.map((value) => ({ value, label: messages.value[PRESET_LABELS[value]] }))
])
const replacementOptions = computed(() => [
  { value: NO_STATUS, label: messages.value.noStatus },
  ...draft.value.map((state) => ({ value: state.id, label: state.name }))
])

const drag = useFlatReorderDrag({
  items: () => draft.value,
  onMove: (id, index) => editor.reorder(id, index)
})

function setupRow(element: Element | ComponentPublicInstance | null, id: string) {
  drag.setupItem(element instanceof HTMLElement ? element : null, () => ({ id }))
}

const list = useTemplateRef<HTMLElement>('list')

/**
 * Deleting a row or applying, which disables Apply, drops the focus they held; the list takes it
 * back so undo and redo still reach the dialog.
 */
function keepFocus() {
  void nextTick(() => list.value?.focus())
}

function removeState(id: string) {
  editor.remove(id)
  keepFocus()
}

function apply() {
  if (editor.apply()) keepFocus()
}

function addState() {
  const name = newName.value.trim()
  if (!name) return
  editor.add(name)
  newName.value = ''
}

function replacementValue(id: string) {
  const target = removals.value[id]
  return target === null ? NO_STATUS : (target ?? '')
}

function choosePreset(value: string) {
  const match = PRESETS.find((candidate) => candidate === value)
  if (match) editor.applyPreset(match)
}

function discard() {
  discarded = true
  store.state.statusesOpen = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :heading="messages.statuses"
    :close-label="common.close"
    size="md"
    :ui="{ footer: 'justify-end' }"
    data-test-id="statuses-dialog"
    @keydown="onKeydown"
  >
    <div ref="list" tabindex="-1" class="flex flex-col gap-2 outline-none">
      <div
        v-for="state in draft"
        :key="state.id"
        :ref="(element) => setupRow(element, state.id)"
        class="relative"
        :data-dragging="drag.draggingId.value === state.id || undefined"
      >
        <div
          v-if="drag.instructionTargetId.value === state.id"
          class="pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-accent"
          :class="drag.instruction.value?.operation === 'reorder-before' ? '-top-1' : '-bottom-1'"
        />
        <StatusStateRow
          :state="state"
          :states="draft"
          @rename="editor.rename(state.id, $event)"
          @color="editor.setColor(state.id, $event)"
          @remove="removeState(state.id)"
        />
      </div>
      <div :class="rows.row()">
        <span aria-hidden="true" />
        <span :class="rows.marker()"><icon-lucide-plus class="size-3.5" aria-hidden="true" /></span>
        <AppInput
          v-model="newName"
          size="sm"
          tone="panel"
          :class="rows.field()"
          :placeholder="messages.newStatus"
          :aria-label="messages.newStatus"
          data-test-id="status-new"
          @enter="addState"
        />
      </div>

      <div
        v-for="state in removed"
        :key="state.id"
        :class="[rows.row(), 'text-[11px] text-muted']"
        data-test-id="status-removed-row"
        :data-state-id="state.id"
      >
        <span aria-hidden="true" />
        <span :class="rows.marker()"><StatusDot :color="state.color" /></span>
        <span class="flex min-w-0 items-center gap-2">
          <span class="truncate">
            <span class="line-through">{{ state.name }}</span>
            {{
              messages.inUse({
                layers: messages.layerCount(usage.get(state.id) ?? 0),
                state: state.name
              })
            }}
          </span>
          <AppSelect
            :model-value="replacementValue(state.id)"
            :options="replacementOptions"
            :label="messages.moveTo"
            :placeholder="messages.moveTo"
            :ui="{ trigger: 'w-40 shrink-0' }"
            @update:model-value="
              editor.chooseReplacement(state.id, $event === NO_STATUS ? null : String($event))
            "
          />
        </span>
        <IconButton :label="messages.restore" @click="editor.restore(state.id)">
          <icon-lucide-undo-2 class="size-3.5" />
        </IconButton>
      </div>

      <AppAlert
        v-if="unresolved.length > 0"
        tone="warning"
        :heading="messages.chooseWhere"
        data-test-id="statuses-unresolved"
      />
      <AppAlert
        v-if="impact.length > 0"
        tone="info"
        :heading="messages.impactHeading"
        data-test-id="statuses-impact"
      >
        <ul class="flex flex-col gap-1">
          <li v-for="(change, index) in impact" :key="index" class="flex items-center gap-1.5">
            <span class="tabular-nums">{{ messages.layerCount(change.count) }}</span>
            <span>{{ change.from }}</span>
            <icon-lucide-arrow-right class="size-3" aria-hidden="true" />
            <span>{{ change.to ?? messages.noStatus }}</span>
          </li>
        </ul>
      </AppAlert>
    </div>

    <template #footer>
      <AppSelect
        :model-value="preset ?? CUSTOM"
        :options="presetOptions"
        :label="messages.preset"
        size="sm"
        :ui="{ trigger: 'w-40' }"
        class="mr-auto"
        @update:model-value="choosePreset(String($event))"
      />
      <AppButton variant="ghost" :disabled="!dirty" @click="editor.reset()">
        {{ common.cancel }}
      </AppButton>
      <AppButton
        color="primary"
        variant="solid"
        :disabled="!dirty || unresolved.length > 0"
        data-test-id="statuses-apply"
        @click="apply"
      >
        {{ common.apply }}
      </AppButton>
    </template>
  </AppDialog>
  <AppConfirmationDialog
    v-model:open="confirmingDiscard"
    :heading="messages.discardTitle"
    :description="messages.discardDescription"
    :cancel-label="common.cancel"
    :confirm-label="messages.discard"
    tone="danger"
    @confirm="discard"
  />
</template>
