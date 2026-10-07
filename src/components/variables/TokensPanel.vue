<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, ref, useTemplateRef, watch } from 'vue'

import type { VariableTokenFields } from '@open-pencil/core/editor'
import type { TokenStylesheetFormat } from '@open-pencil/dom-css/export'
import type { VariableType, VariableValue } from '@open-pencil/scene-graph'
import { useI18n, useSceneComputed, useVariables } from '@open-pencil/vue'

import {
  aliasCandidates,
  groupTree,
  inGroup,
  searchTokenIds,
  tokenGroups,
  type TokenGroup
} from '@/app/editor/tokens/model'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelDrillIn from '@/components/ui/panel/PanelDrillIn.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppTabsList from '@/components/ui/tabs/AppTabsList.vue'
import AppTabsRoot from '@/components/ui/tabs/AppTabsRoot.vue'
import AppTabsTrigger from '@/components/ui/tabs/AppTabsTrigger.vue'
import CollectionInspector from '@/components/variables/CollectionInspector.vue'
import TokenAddMenu from '@/components/variables/TokenAddMenu.vue'
import TokenBulkInspector from '@/components/variables/TokenBulkInspector.vue'
import TokenInspector from '@/components/variables/TokenInspector.vue'
import TokenOutput from '@/components/variables/TokenOutput.vue'
import TokenSidebar from '@/components/variables/TokenSidebar.vue'
import TokenTable from '@/components/variables/TokenTable.vue'
import TokenTypeFilter from '@/components/variables/TokenTypeFilter.vue'
import { useTokenActions } from '@/components/variables/useTokenActions'
import { swapTransition } from '@/theme/motion/styles'
import tokensPanelTheme, {
  TOKENS_PANEL_COMPACT_WIDTH,
  TOKENS_PANEL_SIDEBAR_WIDTH
} from '@/theme/tokens-panel'

const emit = defineEmits<{ copy: [format: TokenStylesheetFormat] }>()

const { variables: messages, common } = useI18n()
const ui = tv(tokensPanelTheme)()

/**
 * The panel lays out by its own width, not the window: inside a dialog, a split view, or a phone.
 * Below the compact width the inspector opens over the list; from the sidebar width collections
 * and groups move into a sidebar.
 */
const root = useTemplateRef('root')
const { width } = useElementSize(root)
const compact = computed(() => width.value > 0 && width.value < TOKENS_PANEL_COMPACT_WIDTH)
const wide = computed(() => width.value >= TOKENS_PANEL_SIDEBAR_WIDTH)

const ctx = useVariables()
const { editor } = ctx
const actions = useTokenActions(editor, (name) => messages.value.duplicateName({ name }))

const selectedIds = ref<string[]>([])
const table = useTemplateRef<{ focus: () => void }>('table')
/** Tokens being put in a new group: the group name field opens for them. */
const groupingIds = ref<string[] | null>(null)
const groupFilter = ref<string | null>(null)
const typeFilter = ref<VariableType[]>([])

/**
 * What the compact detail view shows. It stays set while the view slides out, so Back animates
 * the view that was open instead of switching its content first.
 */
type CompactDetail =
  | { kind: 'token'; id: string }
  | { kind: 'bulk' }
  | { kind: 'collection' }
  | { kind: 'stylesheet' }
const compactDetail = ref<CompactDetail | null>(null)
const detailOpen = ref(false)
/** The mode whose values the single compact column shows. */
const shownModeId = ref('')

/** Read through the scene-computed list, so mode and condition edits re-render. */
const collection = computed(
  () =>
    ctx.collections.value.find((candidate) => candidate.id === ctx.activeCollectionId.value) ?? null
)

/** Every token in the collection, for the sidebar's counts and for lookups a filter must not hide. */
const collectionVariables = useSceneComputed(() =>
  collection.value ? [...editor.getVariablesForCollection(collection.value.id)] : []
)
const allGroups = computed(() =>
  collection.value ? tokenGroups(editor.graph, collection.value, collectionVariables.value) : []
)
const groupEntries = computed(() => groupTree(allGroups.value))

/** Tokens the search matches, or null when there is no search. */
const searchMatches = computed(() =>
  searchTokenIds(
    allGroups.value.flatMap((group) => group.rows),
    ctx.searchTerm.value
  )
)

/** What the list shows: the search, then the sidebar's group and the type filter, in list order. */
const groups = computed<TokenGroup[]>(() =>
  allGroups.value.flatMap((group) => {
    if (groupFilter.value !== null && !inGroup(group.path, groupFilter.value)) return []
    const rows = group.rows.filter(
      (row) =>
        (searchMatches.value?.has(row.variable.id) ?? true) &&
        (typeFilter.value.length === 0 || typeFilter.value.includes(row.variable.type))
    )
    return rows.length > 0 ? [{ ...group, rows }] : []
  })
)

function rowFor(id: string | null | undefined) {
  return allGroups.value.flatMap((group) => group.rows).find((row) => row.variable.id === id)
}

/** The token the inspector edits: the one selected token, or the one opened when compact. */
const editedId = computed(() => {
  if (compact.value)
    return compactDetail.value?.kind === 'token' ? compactDetail.value.id : undefined
  return selectedIds.value.length === 1 ? selectedIds.value[0] : undefined
})
const editedRow = computed(() => rowFor(editedId.value))
const bulkIds = computed(
  () => groupingIds.value ?? (selectedIds.value.length > 1 ? selectedIds.value : null)
)
const candidates = computed(() =>
  editedRow.value ? aliasCandidates(editor.graph, editedRow.value.variable) : []
)

const collectionOptions = computed(() =>
  ctx.collections.value.map((candidate) => ({ value: candidate.id, label: candidate.name }))
)
const sidebarCollections = computed(() =>
  ctx.collections.value.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    count: candidate.variableIds.length
  }))
)
const modeOptions = computed(() =>
  (collection.value?.modes ?? []).map((mode) => ({ value: mode.modeId, label: mode.name }))
)
const tableLabels = computed(() => ({
  name: messages.value.name,
  cssName: messages.value.cssName,
  empty: messages.value.noVariables
}))

watch(
  collection,
  (current) => {
    if (!current?.modes.some((mode) => mode.modeId === shownModeId.value))
      shownModeId.value = current?.defaultModeId ?? ''
  },
  { immediate: true }
)

/**
 * Undo and redo change the document under the panel: tokens being grouped that no longer exist drop
 * out, and a collection that no longer exists gives way to the first one left.
 */
watch(collectionVariables, (current) => {
  const ids = new Set(current.map((variable) => variable.id))
  if (groupingIds.value?.some((id) => !ids.has(id)))
    groupingIds.value = groupingIds.value.filter((id) => ids.has(id))
  if (compactDetail.value?.kind === 'token' && !ids.has(compactDetail.value.id)) closeDetail()
})

/**
 * Only shown tokens stay selected, so a filter, a search or an undo never leaves a hidden token
 * to be edited, moved or deleted.
 */
watch(groups, (current) => {
  const shown = new Set(current.flatMap((group) => group.rows.map((row) => row.variable.id)))
  if (selectedIds.value.some((id) => !shown.has(id)))
    selectedIds.value = selectedIds.value.filter((id) => shown.has(id))
})

/** A group filter lets go once its group is gone, whether deleted, emptied or undone. */
watch(groupEntries, (entries) => {
  if (groupFilter.value !== null && !entries.some((entry) => entry.path === groupFilter.value))
    groupFilter.value = null
})

watch(ctx.collections, (current) => {
  if (current.some((candidate) => candidate.id === ctx.activeCollectionId.value)) return
  ctx.activeCollectionId.value = current[0]?.id ?? ''
})

function focusList() {
  if (!compact.value) table.value?.focus()
}

watch(ctx.activeCollectionId, () => {
  groupFilter.value = null
  closeDetail()
})

watch(selectedIds, (ids) => {
  groupingIds.value = null
  if (!compact.value || ids.length === 0) return
  if (ids.length === 1) openDetail({ kind: 'token', id: ids[0] })
  else openDetail({ kind: 'bulk' })
})

function openDetail(detail: CompactDetail) {
  compactDetail.value = detail
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  selectedIds.value = []
  groupingIds.value = null
}

/** A new token is selected, with nothing hiding it, so its name is ready to edit. */
function addToken(type: VariableType) {
  ctx.searchTerm.value = ''
  groupFilter.value = null
  typeFilter.value = []
  const id = ctx.addVariable(type)
  if (id) selectedIds.value = [id]
}

function removeTokens(ids: readonly string[]) {
  actions.remove(ids)
  closeDetail()
}

function duplicateTokens(ids: readonly string[]) {
  selectedIds.value = actions.duplicate(ids)
}

/** The list follows tokens into their new group when it is narrowed to one. */
function moveToGroup(ids: readonly string[], group: string) {
  actions.moveToGroup(ids, group)
  if (groupFilter.value !== null) groupFilter.value = group || null
  groupingIds.value = null
}

function startNewGroup(ids: string[]) {
  groupingIds.value = ids
  if (compact.value) openDetail({ kind: 'bulk' })
}

function reorder(sourceId: string, targetIndex: number, visibleIds: string[]) {
  if (collection.value) actions.reorder(collection.value.id, sourceId, targetIndex, visibleIds)
}

function setModeAttribute(name: string) {
  if (collection.value) editor.setModeAttribute(collection.value.id, name)
}

function setCondition(modeId: string, condition: string) {
  if (collection.value) editor.setModeCondition(collection.value.id, modeId, condition)
}

/** Props and listeners each inspector takes, the same beside the list and behind Back. */
const tokenInspector = computed(() => {
  const id = editedId.value
  return {
    aliasCandidates: candidates.value,
    onRename: (name: string) => id && editor.renameVariable(id, name),
    onUpdateToken: (patch: Partial<VariableTokenFields>) =>
      id && editor.updateVariableToken(id, patch),
    onUpdateValue: (modeId: string, value: VariableValue, coalesceKey?: string) =>
      id && editor.updateVariableValue(id, modeId, value, coalesceKey),
    onAlias: (modeId: string, aliasId: string) => id && actions.alias(id, modeId, aliasId),
    onDetach: (modeId: string) => id && actions.detach(id, modeId),
    onRemove: () => id && removeTokens([id]),
    onDone: focusList
  }
})
const bulkInspector = computed(() => {
  const ids = bulkIds.value ?? []
  return {
    count: ids.length,
    focusGroup: groupingIds.value !== null,
    onMoveToGroup: (group: string) => moveToGroup(ids, group),
    onDuplicate: () => duplicateTokens(ids),
    onRemove: () => removeTokens(ids)
  }
})
const collectionInspector = computed(() => {
  const current = collection.value
  return {
    onRename: (name: string) => current && ctx.renameCollection(current.id, name),
    onRemove: () => current && ctx.removeCollection(current.id),
    onAddMode: ctx.addMode,
    onRenameMode: ctx.renameMode,
    onDuplicateMode: ctx.duplicateMode,
    onSetDefaultMode: ctx.setDefaultMode,
    onRemoveMode: ctx.removeMode,
    onSetCondition: setCondition,
    onDone: focusList,
    onSetModeAttribute: setModeAttribute
  }
})
const tableActions = {
  onRename: (id: string, name: string) => editor.renameVariable(id, name),
  onUpdateValue: (id: string, modeId: string, value: VariableValue) =>
    editor.updateVariableValue(id, modeId, value),
  onDuplicate: duplicateTokens,
  onMoveToGroup: moveToGroup,
  onNewGroup: startNewGroup,
  onRemove: removeTokens,
  onReorder: reorder
}
const groupOptions = computed(() => groupEntries.value.map((entry) => entry.path))
</script>

<template>
  <div ref="root" :class="ui.root()" data-test-id="tokens-panel">
    <template v-if="!collection">
      <div :class="ui.toolbar()">
        <span class="flex-1" />
        <slot name="actions" />
      </div>
      <AppPlaceholder :label="messages.noVariableCollections">
        <template #icon>
          <icon-lucide-folder class="size-5" />
        </template>
        <template #action>
          <AppButton
            variant="soft"
            data-test-id="variables-create-collection"
            @click="ctx.addCollection"
          >
            {{ messages.createCollection }}
          </AppButton>
        </template>
      </AppPlaceholder>
    </template>

    <!-- Compact: the list, with tokens, the collection, or the stylesheet opening over it. -->
    <PanelDrillIn
      v-else-if="compact"
      :open="detailOpen"
      :back="common.back"
      :parent="collection.name"
      @back="closeDetail"
    >
      <template #actions>
        <slot name="actions" />
      </template>
      <template #detail>
        <TokenInspector
          v-if="compactDetail?.kind === 'token' && editedRow"
          v-bind="tokenInspector"
          :row="editedRow"
          :collection="collection"
          layout="full"
        />
        <TokenBulkInspector
          v-else-if="compactDetail?.kind === 'bulk'"
          v-bind="bulkInspector"
          layout="full"
        />
        <CollectionInspector
          v-else-if="compactDetail?.kind === 'collection'"
          v-bind="collectionInspector"
          :collection="collection"
          layout="full"
        />
        <TokenOutput
          v-else
          :collection-id="collection.id"
          layout="full"
          @copy="emit('copy', $event)"
        />
      </template>

      <div class="flex shrink-0 flex-col gap-2 border-b border-border p-3">
        <div class="flex items-center gap-1">
          <AppSelect
            v-model="ctx.activeCollectionId.value"
            :options="collectionOptions"
            :label="messages.collection"
            :ui="{ trigger: 'min-w-0 flex-1' }"
          />
          <TokenAddMenu @add="addToken" />
          <IconButton
            size="sm"
            :label="messages.createCollection"
            data-test-id="variables-add-collection"
            @click="ctx.addCollection"
          >
            <icon-lucide-folder-plus class="size-4" />
          </IconButton>
          <slot name="actions" />
        </div>
        <div class="flex items-center gap-2">
          <AppInput
            v-model="ctx.searchTerm.value"
            type="search"
            size="sm"
            class="min-w-0 flex-1"
            :placeholder="common.search"
            :aria-label="common.search"
            data-test-id="variables-search-input"
          />
          <AppSelect
            v-if="modeOptions.length > 1"
            v-model="shownModeId"
            :options="modeOptions"
            :label="messages.mode"
            :ui="{ trigger: 'w-28 shrink-0' }"
          />
          <TokenTypeFilter v-model="typeFilter" />
          <IconButton
            :label="messages.collectionSettings"
            data-test-id="variables-collection-settings"
            @click="openDetail({ kind: 'collection' })"
          >
            <icon-lucide-settings-2 class="size-4" />
          </IconButton>
          <IconButton :label="messages.stylesheet" @click="openDetail({ kind: 'stylesheet' })">
            <icon-lucide-braces class="size-4" />
          </IconButton>
        </div>
      </div>
      <TokenTable
        v-model:selected-ids="selectedIds"
        v-bind="tableActions"
        :collection="collection"
        :groups="groups"
        :group-options="groupOptions"
        :labels="tableLabels"
        :mode-ids="[shownModeId]"
      />
    </PanelDrillIn>

    <template v-else>
      <div :class="ui.toolbar()">
        <span v-if="wide" class="flex-1" />
        <AppTabsRoot v-else v-model="ctx.activeCollectionId.value" class="min-w-0 flex-1">
          <AppTabsList :label="messages.collection">
            <AppTabsTrigger
              v-for="candidate in ctx.collections.value"
              :key="candidate.id"
              :value="candidate.id"
              data-test-id="variables-collection-tab"
            >
              {{ candidate.name }}
            </AppTabsTrigger>
          </AppTabsList>
        </AppTabsRoot>
        <AppInput
          v-model="ctx.searchTerm.value"
          type="search"
          size="sm"
          class="w-40"
          :placeholder="common.search"
          :aria-label="common.search"
          data-test-id="variables-search-input"
        />
        <TokenTypeFilter v-model="typeFilter" />
        <IconButton
          v-if="!wide"
          size="sm"
          :label="messages.createCollection"
          data-test-id="variables-add-collection"
          @click="ctx.addCollection"
        >
          <icon-lucide-folder-plus class="size-4" />
        </IconButton>
        <TokenAddMenu :labelled="wide" @add="addToken" />
        <slot name="actions" />
      </div>
      <div :class="ui.body()">
        <TokenSidebar
          v-if="wide"
          v-model:collection-id="ctx.activeCollectionId.value"
          v-model:group="groupFilter"
          :collections="sidebarCollections"
          :groups="groupEntries"
          :total="collectionVariables.length"
          @add-collection="ctx.addCollection"
        />
        <TokenTable
          ref="table"
          v-model:selected-ids="selectedIds"
          v-bind="tableActions"
          :collection="collection"
          :groups="groups"
          :group-options="groupOptions"
          :labels="tableLabels"
        />
        <Transition v-bind="swapTransition" mode="out-in">
          <TokenBulkInspector v-if="bulkIds" key="bulk" v-bind="bulkInspector" />
          <TokenInspector
            v-else-if="editedRow"
            :key="editedRow.variable.id"
            v-bind="tokenInspector"
            :row="editedRow"
            :collection="collection"
          />
          <CollectionInspector
            v-else
            key="collection"
            v-bind="collectionInspector"
            :collection="collection"
          />
        </Transition>
      </div>
      <TokenOutput :collection-id="collection.id" @copy="emit('copy', $event)" />
    </template>
  </div>
</template>
