<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { TokenImportResult } from '@open-pencil/core/editor'
import {
  defaultTokenImportOptions,
  planTokenImport,
  type CollectionTarget,
  type DesignTokenBundle,
  type DesignTokenReadIssue,
  type ImportSkipReason,
  type ModeTarget,
  type TokenImportOptions
} from '@open-pencil/core/io/formats/design-tokens'
import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import { AppDialog } from '@/components/ui/dialog'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'

const { bundle } = defineProps<{ bundle: DesignTokenBundle | null }>()
const emit = defineEmits<{ imported: [result: TokenImportResult] }>()
const open = defineModel<boolean>('open', { default: false })

const store = useEditorStore()
const { variables, common } = useI18n()

const options = ref<TokenImportOptions | null>(null)
watch(
  () => bundle,
  (current) => {
    options.value = current ? defaultTokenImportOptions(store.graph, current) : null
  },
  { immediate: true }
)

/** Whether a choice names a collection or mode the document no longer has, as after an undo. */
function isStale(choices: TokenImportOptions): boolean {
  return choices.collections.some(({ target, modes }) => {
    if (target.kind !== 'existing') return false
    const collection = store.graph.variableCollections.get(target.collectionId)
    if (!collection) return true
    return modes.some(
      (mode) =>
        mode.kind === 'existing' &&
        !collection.modes.some((candidate) => candidate.modeId === mode.modeId)
    )
  })
}

// The plan reads the document, so it follows every change to it, and choices that went stale
// start over from the defaults.
watch(
  () => store.state.sceneVersion,
  () => {
    if (bundle && options.value && isStale(options.value))
      options.value = defaultTokenImportOptions(store.graph, bundle)
  }
)

function currentPlan() {
  return bundle && options.value ? planTokenImport(store.graph, bundle, options.value) : null
}

const plan = computed(() => {
  void store.state.sceneVersion
  return currentPlan()
})
const existingCollections = computed(() => {
  void store.state.sceneVersion
  return [...store.graph.variableCollections.values()]
})
const styleCount = computed(
  () =>
    bundle?.composites.filter((token) => token.type === 'typography' || token.type === 'shadow')
      .length ?? 0
)

/** Select values: `new`, `skip`, or `existing:<id>`. */
function targetValue(target: CollectionTarget | ModeTarget): string {
  if (target.kind === 'existing')
    return `existing:${'collectionId' in target ? target.collectionId : target.modeId}`
  return target.kind
}

function collectionOptions() {
  return [
    { value: 'new', label: variables.value.importNewCollection },
    ...existingCollections.value.map((collection) => ({
      value: `existing:${collection.id}`,
      label: collection.name
    })),
    { value: 'skip', label: variables.value.importSkipTarget }
  ]
}

function modeOptions(index: number) {
  const target = options.value?.collections[index]?.target
  const existing =
    target?.kind === 'existing'
      ? store.graph.variableCollections.get(target.collectionId)
      : undefined
  return [
    { value: 'new', label: variables.value.importNewMode },
    ...(existing?.modes ?? []).map((mode) => ({
      value: `existing:${mode.modeId}`,
      label: mode.name
    })),
    { value: 'skip', label: variables.value.importSkipTarget }
  ]
}

/** Picking a collection matches its modes by name again, as the default choices do. */
function setCollection(index: number, value: string) {
  const choice = options.value?.collections[index]
  const source = bundle?.collections[index]
  if (!choice || !source) return
  if (value === 'skip' || value === 'new') {
    choice.target = value === 'skip' ? { kind: 'skip' } : { kind: 'new', name: source.name }
    choice.modes = source.modes.map((mode) => ({ kind: 'new', name: mode.name }))
    return
  }
  const collectionId = value.slice('existing:'.length)
  const existing = store.graph.variableCollections.get(collectionId)
  choice.target = { kind: 'existing', collectionId }
  choice.modes = source.modes.map((mode): ModeTarget => {
    const match = existing?.modes.find((candidate) => candidate.name === mode.name)
    return match ? { kind: 'existing', modeId: match.modeId } : { kind: 'new', name: mode.name }
  })
}

function setMode(index: number, modeIndex: number, value: string) {
  const choice = options.value?.collections[index]
  const name = bundle?.collections[index]?.modes[modeIndex]?.name ?? ''
  if (!choice) return
  if (value === 'skip') choice.modes[modeIndex] = { kind: 'skip' }
  else if (value === 'new') choice.modes[modeIndex] = { kind: 'new', name }
  else choice.modes[modeIndex] = { kind: 'existing', modeId: value.slice('existing:'.length) }
}

const REASONS: Record<ImportSkipReason, () => string> = {
  'unsupported-type': () => variables.value.importReasonUnsupportedType,
  'invalid-value': () => variables.value.importReasonInvalidValue,
  'type-mismatch': () => variables.value.importReasonTypeMismatch,
  'missing-alias': () => variables.value.importReasonMissingAlias,
  'not-added': () => variables.value.importReasonNotAdded,
  'mixed-types': () => variables.value.importReasonMixedTypes
}

function issueText(issue: DesignTokenReadIssue): string {
  return issue.kind === 'invalid-file'
    ? variables.value.importInvalidFile({ file: issue.file })
    : variables.value.importMissingFile({ file: issue.file, from: issue.from })
}

const changes = computed(() =>
  plan.value ? plan.value.counts.added + plan.value.counts.updated : 0
)
const empty = computed(
  () => !bundle || (bundle.collections.length === 0 && bundle.composites.length === 0)
)

function importTokens() {
  // Planned again against the document as it is now, not as it was when the plan was shown.
  const fresh = currentPlan()
  if (!fresh) return
  const count = fresh.counts.added + fresh.counts.updated
  if (count === 0) return
  const result = store.importDesignTokens(fresh)
  toast.info(notificationMessages.get().designTokensImported({ count }))
  open.value = false
  emit('imported', result)
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    size="md"
    :heading="variables.importDesignTokens"
    :description="variables.importTokensDescription"
    :close-label="common.close"
    :ui="{ footer: 'justify-between' }"
    data-test-id="variables-import-dialog"
  >
    <div class="flex flex-col gap-3 text-xs">
      <p v-if="empty" class="text-muted">{{ variables.importNothing }}</p>

      <AppAlert
        v-for="issue in bundle?.issues ?? []"
        :key="`${issue.kind}:${issue.file}`"
        tone="warning"
        :heading="issueText(issue)"
      />

      <div
        v-if="options && bundle?.collections.length"
        class="max-h-72 overflow-y-auto rounded-lg border border-border"
      >
        <section
          v-for="(collection, index) in bundle.collections"
          :key="`${index}:${collection.name}`"
          class="border-b border-border py-1 last:border-b-0"
          data-test-id="variables-import-collection"
        >
          <div class="grid grid-cols-[minmax(0,1fr)_auto_10rem] items-center gap-2 px-3 py-1">
            <span class="truncate font-medium text-surface">{{ collection.name }}</span>
            <icon-lucide-arrow-right class="size-3 text-muted" aria-hidden="true" />
            <AppSelect
              :model-value="targetValue(options.collections[index].target)"
              :options="collectionOptions()"
              :label="collection.name"
              @update:model-value="setCollection(index, $event)"
            />
          </div>
          <template v-if="options.collections[index].target.kind !== 'skip'">
            <div
              v-for="(mode, modeIndex) in collection.modes"
              :key="`${modeIndex}:${mode.name}`"
              class="grid grid-cols-[minmax(0,1fr)_auto_10rem] items-center gap-2 py-1 pr-3 pl-6"
            >
              <span class="truncate text-muted">{{ mode.name }}</span>
              <icon-lucide-arrow-right class="size-3 text-muted" aria-hidden="true" />
              <AppSelect
                :model-value="targetValue(options.collections[index].modes[modeIndex])"
                :options="modeOptions(index)"
                :label="`${collection.name}: ${mode.name}`"
                @update:model-value="setMode(index, modeIndex, $event)"
              />
            </div>
          </template>
        </section>
      </div>

      <div v-if="options && !empty" class="flex flex-col gap-2">
        <label class="flex items-center gap-2">
          <AppCheckbox v-model="options.addMissing" :ariaLabel="variables.importAddMissing" />
          {{ variables.importAddMissing }}
        </label>
        <label v-if="styleCount > 0" class="flex items-center gap-2">
          <AppCheckbox
            v-model="options.styles"
            :ariaLabel="variables.importStyles({ count: styleCount })"
          />
          {{ variables.importStyles({ count: styleCount }) }}
        </label>
      </div>

      <AppCollapsible v-if="plan?.skipped.length">
        <template #label>
          {{ variables.importSkippedTitle }}
          <span class="text-muted">{{ plan.skipped.length }}</span>
        </template>
        <ul class="mt-2 max-h-32 overflow-y-auto rounded-lg border border-border">
          <li
            v-for="(skip, index) in plan.skipped"
            :key="`${index}:${skip.name}`"
            class="flex items-baseline justify-between gap-3 border-b border-border px-3 py-1.5 last:border-b-0"
          >
            <span class="truncate text-surface">{{ skip.name }}</span>
            <span class="shrink-0 text-muted">{{ REASONS[skip.reason]() }}</span>
          </li>
        </ul>
      </AppCollapsible>
    </div>

    <template #footer>
      <span class="text-xs text-muted" data-test-id="variables-import-summary">
        {{ plan && !empty ? variables.importSummary(plan.counts) : '' }}
      </span>
      <div class="flex gap-2">
        <AppButton color="neutral" variant="ghost" @click="open = false">
          {{ common.cancel }}
        </AppButton>
        <AppButton
          color="primary"
          variant="solid"
          :disabled="changes === 0"
          data-test-id="variables-import-confirm"
          @click="importTokens"
        >
          {{ variables.importAction }}
        </AppButton>
      </div>
    </template>
  </AppDialog>
</template>
