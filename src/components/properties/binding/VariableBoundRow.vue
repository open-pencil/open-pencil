<script setup lang="ts">
import { computed } from 'vue'

import { variableText } from '@open-pencil/scene-graph/variables'
import { useEditor } from '@open-pencil/vue'
import type { BindingProvider } from '@open-pencil/vue/controls/binding-provider'
import { useI18n } from '@open-pencil/vue/i18n'
import { BindableValueRoot } from '@open-pencil/vue/primitives/BindableValue'

import IconButton from '@/components/ui/button/IconButton.vue'
import { VARIABLE_TYPE_ICONS } from '@/components/variables/type-icons'

import BoundFieldRow from './BoundFieldRow.vue'
import { BOUND_LAYER_FIELDS, type BoundLayerField } from './fields'

/**
 * The variable a layer field follows, with its value here and a way to let go of it.
 */
const { nodeId, field, label } = defineProps<{
  nodeId: string
  field: BoundLayerField
  label: string
}>()

const editor = useEditor()
const { panels } = useI18n()
const config = BOUND_LAYER_FIELDS[field]
// The row reads the binding alone, never the field's value, so any field's provider fits.
const provider: BindingProvider<unknown> = config.useProvider()
const targets = computed(() => [{ nodeId, path: config.path }])

function valueText(variableId: string) {
  return variableText(editor.graph.resolveVariableForNode(nodeId, variableId))
}
</script>

<template>
  <BindableValueRoot v-slot="binding" :provider="provider" :targets="targets" :value="undefined">
    <BoundFieldRow
      v-if="binding.state !== 'unbound'"
      :label="label"
      :name="binding.variable?.name ?? binding.bindingId ?? panels.unresolvedVariable"
      :value="binding.variable ? valueText(binding.variable.id) : undefined"
      :tone="binding.state === 'unresolved' ? 'unresolved' : 'variable'"
    >
      <template #icon>
        <component
          :is="VARIABLE_TYPE_ICONS[binding.variable?.type ?? 'STRING']"
          class="size-3.5 shrink-0 text-muted"
          aria-hidden="true"
        />
      </template>
      <template #actions>
        <IconButton :label="panels.detachVariable" @click="binding.actions.unbind()">
          <icon-lucide-unlink class="size-3.5" />
        </IconButton>
      </template>
    </BoundFieldRow>
  </BindableValueRoot>
</template>
