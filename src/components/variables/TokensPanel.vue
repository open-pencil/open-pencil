<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, ref, watch } from 'vue'

import type { VariableTokenFields } from '@open-pencil/core/editor'
import type { TokenStylesheetFormat } from '@open-pencil/dom-css/export'
import type { VariableValue } from '@open-pencil/scene-graph'
import { useI18n, useVariables, useViewportKind } from '@open-pencil/vue'

import { tokenGroups } from '@/app/editor/tokens/model'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppTabsList from '@/components/ui/tabs/AppTabsList.vue'
import AppTabsRoot from '@/components/ui/tabs/AppTabsRoot.vue'
import AppTabsTrigger from '@/components/ui/tabs/AppTabsTrigger.vue'
import CollectionInspector from '@/components/variables/CollectionInspector.vue'
import TokenInspector from '@/components/variables/TokenInspector.vue'
import TokenOutput from '@/components/variables/TokenOutput.vue'
import TokenTable from '@/components/variables/TokenTable.vue'
import tokensPanelTheme from '@/theme/tokens-panel'

const emit = defineEmits<{ copy: [format: TokenStylesheetFormat] }>()

const { variables: messages, common } = useI18n()
const { isMobile } = useViewportKind()
const ui = tv(tokensPanelTheme)()
const ctx = useVariables()
const { editor } = ctx
const selectedId = ref<string | null>(null)
/** On mobile one view fills the panel; the token, the modes, or the stylesheet open over the list. */
const mobileView = ref<'list' | 'modes' | 'stylesheet'>('list')
/** The mode whose values the single mobile column shows. */
const shownModeId = ref('')

/** Read through the scene-computed list, so mode and condition edits re-render. */
const collection = computed(
  () =>
    ctx.collections.value.find((candidate) => candidate.id === ctx.activeCollectionId.value) ?? null
)

const groups = computed(() =>
  collection.value ? tokenGroups(editor.graph, collection.value, ctx.variables.value) : []
)

const selectedRow = computed(() =>
  groups.value.flatMap((group) => group.rows).find((row) => row.variable.id === selectedId.value)
)

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
  mobileView.value = 'list'
})

function backToList() {
  selectedId.value = null
  mobileView.value = 'list'
}

function updateToken(patch: Partial<VariableTokenFields>) {
  if (selectedId.value) editor.updateVariableToken(selectedId.value, patch)
}

function updateValue(modeId: string, value: VariableValue) {
  if (selectedId.value) editor.updateVariableValue(selectedId.value, modeId, value)
}

function rename(name: string) {
  if (selectedId.value) editor.renameVariable(selectedId.value, name)
}

function setCondition(modeId: string, condition: string) {
  if (collection.value) editor.setModeCondition(collection.value.id, modeId, condition)
}
</script>

<template>
  <div v-if="collection" class="flex min-h-0 flex-1 flex-col" data-test-id="tokens-panel">
    <!-- Mobile: one view at a time, opened from the list and closed with Back. -->
    <template v-if="isMobile">
      <template v-if="selectedRow || mobileView !== 'list'">
        <div :class="ui.backBar()">
          <IconButton :label="common.back" data-test-id="tokens-back" @click="backToList">
            <icon-lucide-chevron-left class="size-4" />
          </IconButton>
          <span class="truncate">
            {{
              selectedRow?.variable.name ??
              (mobileView === 'modes' ? messages.modes : messages.stylesheet)
            }}
          </span>
        </div>
        <TokenInspector
          v-if="selectedRow"
          :key="selectedRow.variable.id"
          :row="selectedRow"
          :collection="collection"
          layout="full"
          @rename="rename"
          @update-token="updateToken"
          @update-value="updateValue"
        />
        <CollectionInspector
          v-else-if="mobileView === 'modes'"
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
      <template v-else>
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
            <IconButton :label="messages.modes" @click="mobileView = 'modes'">
              <icon-lucide-layers class="size-4" />
            </IconButton>
            <IconButton :label="messages.stylesheet" @click="mobileView = 'stylesheet'">
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
          stacked
        />
      </template>
    </template>

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
        <TokenInspector
          v-if="selectedRow"
          :key="selectedRow.variable.id"
          :row="selectedRow"
          :collection="collection"
          @rename="rename"
          @update-token="updateToken"
          @update-value="updateValue"
        />
        <CollectionInspector v-else :collection="collection" @set-condition="setCondition" />
      </div>
      <TokenOutput :collection-id="collection.id" @copy="emit('copy', $event)" />
    </template>
  </div>
</template>
