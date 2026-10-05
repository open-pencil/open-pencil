<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, ref, useTemplateRef, watch } from 'vue'

import type { VariableTokenFields } from '@open-pencil/core/editor'
import type { TokenStylesheetFormat } from '@open-pencil/dom-css/export'
import type { VariableValue } from '@open-pencil/scene-graph'
import { useI18n, useVariables } from '@open-pencil/vue'

import { tokenGroups } from '@/app/editor/tokens/model'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelDrillIn from '@/components/ui/panel/PanelDrillIn.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppTabsList from '@/components/ui/tabs/AppTabsList.vue'
import AppTabsRoot from '@/components/ui/tabs/AppTabsRoot.vue'
import AppTabsTrigger from '@/components/ui/tabs/AppTabsTrigger.vue'
import CollectionInspector from '@/components/variables/CollectionInspector.vue'
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
type CompactDetail = { kind: 'token'; id: string } | { kind: 'modes' } | { kind: 'stylesheet' }
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

watch(
  collection,
  (current) => {
    if (!current?.modes.some((mode) => mode.modeId === shownModeId.value))
      shownModeId.value = current?.defaultModeId ?? ''
  },
  { immediate: true }
)

watch(ctx.activeCollectionId, () => {
  selectedId.value = null
  detailOpen.value = false
})

watch(selectedId, (id) => {
  if (compact.value && id) openDetail({ kind: 'token', id })
})

function openDetail(detail: CompactDetail) {
  compactDetail.value = detail
  detailOpen.value = true
}

function back() {
  detailOpen.value = false
  selectedId.value = null
}

function updateToken(patch: Partial<VariableTokenFields>) {
  if (editedId.value) editor.updateVariableToken(editedId.value, patch)
}

function updateValue(modeId: string, value: VariableValue) {
  if (editedId.value) editor.updateVariableValue(editedId.value, modeId, value)
}

function rename(name: string) {
  if (editedId.value) editor.renameVariable(editedId.value, name)
}

function setCondition(modeId: string, condition: string) {
  if (collection.value) editor.setModeCondition(collection.value.id, modeId, condition)
}
</script>

<template>
  <div v-if="collection" ref="root" :class="ui.root()" data-test-id="tokens-panel">
    <!-- Compact: the list, with a token, the modes, or the stylesheet opening over it. -->
    <PanelDrillIn
      v-if="compact"
      :open="detailOpen"
      :back="common.back"
      :parent="collection.name"
      @back="back"
    >
      <template #detail>
        <TokenInspector
          v-if="compactDetail?.kind === 'token' && editedRow"
          :row="editedRow"
          :collection="collection"
          layout="full"
          @rename="rename"
          @update-token="updateToken"
          @update-value="updateValue"
        />
        <CollectionInspector
          v-else-if="compactDetail?.kind === 'modes'"
          :collection="collection"
          layout="full"
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
        <AppSelect
          v-model="ctx.activeCollectionId.value"
          :options="collectionOptions"
          :label="messages.collection"
          :ui="{ trigger: 'w-full' }"
        />
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
          <IconButton :label="messages.modes" @click="openDetail({ kind: 'modes' })">
            <icon-lucide-layers class="size-4" />
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
        :labels="{ name: messages.name, cssName: messages.cssName }"
        :mode-ids="[shownModeId]"
      />
    </PanelDrillIn>

    <template v-else>
      <div class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
        <AppTabsRoot v-model="ctx.activeCollectionId.value" class="min-w-0 flex-1">
          <AppTabsList :label="messages.collection">
            <AppTabsTrigger
              v-for="candidate in ctx.collections.value"
              :key="candidate.id"
              :value="candidate.id"
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
        <slot name="actions" />
      </div>
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <TokenTable
          v-model:selected-id="selectedId"
          :collection="collection"
          :groups="groups"
          :labels="{ name: messages.name, cssName: messages.cssName }"
        />
        <Transition v-bind="swapTransition" mode="out-in">
          <TokenInspector
            v-if="editedRow"
            :key="editedRow.variable.id"
            :row="editedRow"
            :collection="collection"
            @rename="rename"
            @update-token="updateToken"
            @update-value="updateValue"
          />
          <CollectionInspector
            v-else
            key="collection"
            :collection="collection"
            @set-condition="setCondition"
          />
        </Transition>
      </div>
      <TokenOutput :collection-id="collection.id" @copy="emit('copy', $event)" />
    </template>
  </div>
</template>
