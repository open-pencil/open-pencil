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
import { AppDialog } from '@/components/ui/dialog'
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

const plan = computed(() =>
  bundle && options.value ? planTokenImport(store.graph, bundle, options.value) : null
)
const existingCollections = computed(() => [...store.graph.variableCollections.values()])
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

function collectionOptions(name: string) {
  return [
    { value: 'new', label: variables.value.importNewCollection({ name }) },
    ...existingCollections.value.map((collection) => ({
      value: `existing:${collection.id}`,
      label: collection.name
    })),
    { value: 'skip', label: variables.value.importSkipTarget }
  ]
}

function modeOptions(index: number, name: string) {
  const target = options.value?.collections[index]?.target
  const existing =
    target?.kind === 'existing'
      ? store.graph.variableCollections.get(target.collectionId)
      : undefined
  return [
    { value: 'new', label: variables.value.importNewMode({ name }) },
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
  if (!plan.value || changes.value === 0) return
  const result = store.importDesignTokens(plan.value)
  toast.info(notificationMessages.get().designTokensImported({ count: changes.value }))
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
    data-test-id="variables-import-dialog"
  >
    <div class="flex flex-col gap-4 text-xs">
      <p v-if="empty" class="text-muted">{{ variables.importNothing }}</p>
      <section
        v-for="(collection, index) in bundle?.collections ?? []"
        :key="`${index}:${collection.name}`"
        class="flex flex-col gap-2"
        data-test-id="variables-import-collection"
      >
        <AppSelect
          v-if="options"
          :model-value="targetValue(options.collections[index].target)"
          :options="collectionOptions(collection.name)"
          :label="collection.name"
          :ui="{ trigger: 'w-full' }"
          @update:model-value="setCollection(index, $event)"
        />
        <div
          v-if="options && options.collections[index].target.kind !== 'skip'"
          class="flex flex-col gap-1.5 pl-3"
        >
          <label
            v-for="(mode, modeIndex) in collection.modes"
            :key="`${modeIndex}:${mode.name}`"
            class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-2"
          >
            <span class="truncate text-muted">{{ mode.name }}</span>
            <AppSelect
              :model-value="targetValue(options.collections[index].modes[modeIndex])"
              :options="modeOptions(index, mode.name)"
              :label="`${collection.name}: ${mode.name}`"
              :ui="{ trigger: 'w-full' }"
              @update:model-value="setMode(index, modeIndex, $event)"
            />
          </label>
        </div>
      </section>

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

      <p
        v-if="plan && !empty"
        class="font-medium text-surface"
        data-test-id="variables-import-summary"
      >
        {{ variables.importSummary(plan.counts) }}
      </p>

      <ul v-if="bundle?.issues.length" class="flex flex-col gap-1 text-warning-text">
        <li v-for="issue in bundle.issues" :key="`${issue.kind}:${issue.file}`">
          {{ issueText(issue) }}
        </li>
      </ul>

      <details v-if="plan?.skipped.length" class="text-muted">
        <summary class="cursor-default select-none">{{ variables.importSkippedTitle }}</summary>
        <ul class="mt-1 flex max-h-40 flex-col gap-0.5 overflow-auto">
          <li v-for="(skip, index) in plan.skipped" :key="`${index}:${skip.name}`">
            <span class="font-mono text-surface">{{ skip.name }}</span>
            — {{ REASONS[skip.reason]() }}
          </li>
        </ul>
      </details>
    </div>

    <template #footer>
      <AppButton color="neutral" variant="ghost" @click="open = false">{{
        common.cancel
      }}</AppButton>
      <AppButton
        color="primary"
        variant="solid"
        :disabled="changes === 0"
        data-test-id="variables-import-confirm"
        @click="importTokens"
      >
        {{ variables.importAction }}
      </AppButton>
    </template>
  </AppDialog>
</template>
