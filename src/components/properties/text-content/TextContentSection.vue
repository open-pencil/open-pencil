<script setup lang="ts">
import { useI18n } from '@open-pencil/vue/i18n'

import VariableBoundRow from '@/components/properties/binding/VariableBoundRow.vue'
import PropertyBoundField from '@/components/properties/component-properties/PropertyBoundField.vue'

/**
 * What a text layer's content follows, under the layer's header as Figma's Content row: a
 * component property or a variable. Content is what the layer says, so it sits apart from
 * Typography, which is how it looks.
 */
const { nodeId } = defineProps<{ nodeId: string }>()

const { panels } = useI18n()
</script>

<template>
  <!-- Both rows render nothing while unbound; `empty:hidden` then drops the band too. -->
  <div class="border-b border-border px-3 pt-2 pb-1.5 empty:hidden">
    <PropertyBoundField field="TEXT" :label="panels.content" />
    <VariableBoundRow :node-id="nodeId" field="TEXT" :label="panels.content" />
  </div>
</template>
