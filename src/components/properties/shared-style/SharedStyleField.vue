<script setup lang="ts">
import type { SharedStyleKind } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import { useSharedStylePicker } from '@/components/properties/shared-style/useSharedStylePicker'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import AppPickerField from '@/components/ui/select/AppPickerField.vue'

const { kind, label } = defineProps<{ kind: SharedStyleKind; label: string }>()
const { visible, value, options, update } = useSharedStylePicker(kind)
const { panels, common } = useI18n()
</script>

<template>
  <PanelGrid v-if="visible" class="mb-1.5">
    <PanelFieldGroup :label="label">
      <AppPickerField
        :model-value="value"
        :items="options"
        :label="label"
        :search-placeholder="panels.searchStyles"
        :empty-label="panels.noStylesFound"
        :close-label="common.close"
        :data-property="`${kind}-style`"
        @update:model-value="update"
      />
    </PanelFieldGroup>
  </PanelGrid>
</template>
