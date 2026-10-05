<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { VariableTokenFields } from '@open-pencil/core/editor'
import type { TokenStylesheetFormat } from '@open-pencil/dom-css/export'
import type { VariableValue } from '@open-pencil/scene-graph'
import { useI18n, useVariables } from '@open-pencil/vue'

import { tokenGroups } from '@/app/editor/tokens/model'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTabsList from '@/components/ui/tabs/AppTabsList.vue'
import AppTabsRoot from '@/components/ui/tabs/AppTabsRoot.vue'
import AppTabsTrigger from '@/components/ui/tabs/AppTabsTrigger.vue'
import CollectionInspector from '@/components/variables/CollectionInspector.vue'
import TokenInspector from '@/components/variables/TokenInspector.vue'
import TokenOutput from '@/components/variables/TokenOutput.vue'
import TokenTable from '@/components/variables/TokenTable.vue'

const emit = defineEmits<{ copy: [format: TokenStylesheetFormat] }>()

const { variables: messages, common } = useI18n()
const ctx = useVariables()
const { editor } = ctx
const selectedId = ref<string | null>(null)

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

watch(ctx.activeCollectionId, () => {
  selectedId.value = null
})

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
        :placeholder="common.search"
        :aria-label="common.search"
        class="w-40"
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
  </div>
</template>
