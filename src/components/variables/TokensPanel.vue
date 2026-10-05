<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, ref, useTemplateRef, watch } from 'vue'

import type { VariableTokenFields } from '@open-pencil/core/editor'
import type { TokenStylesheetFormat } from '@open-pencil/dom-css/export'
import type { VariableType, VariableValue } from '@open-pencil/scene-graph'
import { useI18n, useVariables } from '@open-pencil/vue'

import { tokenGroups } from '@/app/editor/tokens/model'
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
import TokenInspector from '@/components/variables/TokenInspector.vue'
import TokenOutput from '@/components/variables/TokenOutput.vue'
import TokenTable from '@/components/variables/TokenTable.vue'
import { swapTransition } from '@/theme/motion/styles'
import tokensPanelTheme, { TOKENS_PANEL_COMPACT_WIDTH } from '@/theme/tokens-panel'

const emit = defineEmits<{ copy: [format: TokenStylesheetFormat] }>()

const { variables: messages, common } = useI18n()
const ui = tv(tokensPanelTheme)()

/**
 * The panel lays out by its own width, not the window: inside a dialog, a split view, or a phone.
 * Below the compact width the inspector no longer fits beside the list and opens over it instead.
 */
const root = useTemplateRef('root')
const { width } = useElementSize(root)
const compact = computed(() => width.value > 0 && width.value < TOKENS_PANEL_COMPACT_WIDTH)

const ctx = useVariables()
const { editor } = ctx
const selectedId = ref<string | null>(null)

/**
 * What the compact detail view shows. It stays set while the view slides out, so Back animates
 * the view that was open instead of switching its content first.
 */
type CompactDetail = { kind: 'token'; id: string } | { kind: 'collection' } | { kind: 'stylesheet' }
const compactDetail = ref<CompactDetail | null>(null)
const detailOpen = ref(false)
/** The mode whose values the single compact column shows. */
const shownModeId = ref('')

/** Read through the scene-computed list, so mode and condition edits re-render. */
const collection = computed(
  () =>
    ctx.collections.value.find((candidate) => candidate.id === ctx.activeCollectionId.value) ?? null
)

const groups = computed(() =>
  collection.value ? tokenGroups(editor.graph, collection.value, ctx.variables.value) : []
)

function rowFor(id: string | null | undefined) {
  return groups.value.flatMap((group) => group.rows).find((row) => row.variable.id === id)
}

/** The token the inspector edits: the selection beside the list, the opened token when compact. */
const editedId = computed(() => {
  if (!compact.value) return selectedId.value
  return compactDetail.value?.kind === 'token' ? compactDetail.value.id : null
})
const editedRow = computed(() => rowFor(editedId.value))

const collectionOptions = computed(() =>
  ctx.collections.value.map((candidate) => ({ value: candidate.id, label: candidate.name }))
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

watch(ctx.activeCollectionId, closeDetail)

watch(selectedId, (id) => {
  if (compact.value && id) openDetail({ kind: 'token', id })
})

function openDetail(detail: CompactDetail) {
  compactDetail.value = detail
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  selectedId.value = null
}

/** A new token is selected, so its name is ready to edit beside the list or behind Back. */
function addToken(type: VariableType) {
  ctx.searchTerm.value = ''
  const id = ctx.addVariable(type)
  if (id) selectedId.value = id
}

function removeToken() {
  if (editedId.value) ctx.removeVariable(editedId.value)
  closeDetail()
}

function updateToken(patch: Partial<VariableTokenFields>) {
  if (editedId.value) editor.updateVariableToken(editedId.value, patch)
}

function updateValue(modeId: string, value: VariableValue) {
  if (editedId.value) editor.updateVariableValue(editedId.value, modeId, value)
}

function renameToken(name: string) {
  if (editedId.value) editor.renameVariable(editedId.value, name)
}

function renameCollection(name: string) {
  if (collection.value) ctx.renameCollection(collection.value.id, name)
}

function removeCollection() {
  if (collection.value) ctx.removeCollection(collection.value.id)
}

function setCondition(modeId: string, condition: string) {
  if (collection.value) editor.setModeCondition(collection.value.id, modeId, condition)
}
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

    <!-- Compact: the list, with a token, the collection, or the stylesheet opening over it. -->
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
          :row="editedRow"
          :collection="collection"
          layout="full"
          @rename="renameToken"
          @update-token="updateToken"
          @update-value="updateValue"
          @remove="removeToken"
        />
        <CollectionInspector
          v-else-if="compactDetail?.kind === 'collection'"
          :collection="collection"
          layout="full"
          @rename="renameCollection"
          @remove="removeCollection"
          @add-mode="ctx.addMode"
          @rename-mode="ctx.renameMode"
          @duplicate-mode="ctx.duplicateMode"
          @set-default-mode="ctx.setDefaultMode"
          @remove-mode="ctx.removeMode"
          @set-condition="setCondition"
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
        v-model:selected-id="selectedId"
        :collection="collection"
        :groups="groups"
        :labels="tableLabels"
        :mode-ids="[shownModeId]"
      />
    </PanelDrillIn>

    <template v-else>
      <div :class="ui.toolbar()">
        <AppTabsRoot v-model="ctx.activeCollectionId.value" class="min-w-0 flex-1">
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
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <TokenTable
          v-model:selected-id="selectedId"
          :collection="collection"
          :groups="groups"
          :labels="tableLabels"
        />
        <Transition v-bind="swapTransition" mode="out-in">
          <TokenInspector
            v-if="editedRow"
            :key="editedRow.variable.id"
            :row="editedRow"
            :collection="collection"
            @rename="renameToken"
            @update-token="updateToken"
            @update-value="updateValue"
            @remove="removeToken"
          />
          <CollectionInspector
            v-else
            key="collection"
            :collection="collection"
            @rename="renameCollection"
            @remove="removeCollection"
            @add-mode="ctx.addMode"
            @rename-mode="ctx.renameMode"
            @duplicate-mode="ctx.duplicateMode"
            @set-default-mode="ctx.setDefaultMode"
            @remove-mode="ctx.removeMode"
            @set-condition="setCondition"
          />
        </Transition>
      </div>
      <TokenOutput :collection-id="collection.id" @copy="emit('copy', $event)" />
    </template>
  </div>
</template>
