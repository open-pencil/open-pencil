<script setup lang="ts">
import type { SharedStyleKind } from '@open-pencil/scene-graph'

import { useSharedStylePicker } from '@/components/properties/shared-style/useSharedStylePicker'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const { kind, label } = defineProps<{ kind: SharedStyleKind; label: string }>()
const { visible, value, options, update } = useSharedStylePicker(kind)
</script>

<template>
  <PanelGrid v-if="visible" class="mb-1.5">
    <PanelFieldGroup :label="label">
      <AppSelect
        :model-value="value"
        :options="options"
        :label="label"
        :data-property="`${kind}-style`"
        @update:model-value="update"
      />
    </PanelFieldGroup>
  </PanelGrid>
</template>
