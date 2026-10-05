<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { reactive, watch } from 'vue'

import type { VariableCollection } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import { modeConditionPlaceholder } from '@/app/editor/tokens/model'
import AppBadge from '@/components/ui/feedback/AppBadge.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import tokensPanelTheme from '@/theme/tokens-panel'

const { collection } = defineProps<{ collection: VariableCollection }>()
const emit = defineEmits<{ setCondition: [modeId: string, condition: string] }>()

const { variables } = useI18n()
const ui = tv(tokensPanelTheme)()

/** Conditions edit a draft and commit on change, like the token fields. */
const conditions = reactive<Record<string, string>>({})
watch(
  () => collection.modes.map((mode) => [mode.modeId, mode.condition ?? ''] as const),
  (current) => {
    for (const [modeId, condition] of current) conditions[modeId] = condition
  },
  { immediate: true }
)

function commit(modeId: string) {
  const mode = collection.modes.find((candidate) => candidate.modeId === modeId)
  if ((conditions[modeId] ?? '') !== (mode?.condition ?? ''))
    emit('setCondition', modeId, conditions[modeId] ?? '')
}
</script>

<template>
  <aside :class="ui.inspector()" data-test-id="collection-inspector">
    <section :class="ui.section()">
      <h3 :class="ui.sectionTitle()">{{ variables.modes }}</h3>
      <div v-for="mode in collection.modes" :key="mode.modeId" :class="ui.field()">
        <span class="flex items-center gap-2 text-xs text-surface">
          {{ mode.name }}
          <AppBadge v-if="mode.modeId === collection.defaultModeId">
            {{ variables.defaultMode }}
          </AppBadge>
        </span>
        <span v-if="mode.modeId === collection.defaultModeId" :class="ui.cssName()">:root</span>
        <AppInput
          v-else
          v-model="conditions[mode.modeId]"
          size="sm"
          :aria-label="`${mode.name} ${variables.condition}`"
          :placeholder="modeConditionPlaceholder(collection, mode.modeId)"
          :ui="{ input: 'font-mono' }"
          @change="commit(mode.modeId)"
        />
      </div>
      <span :class="ui.hint()">{{ variables.conditionHint }}</span>
    </section>
  </aside>
</template>
