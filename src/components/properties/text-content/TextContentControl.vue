<script setup lang="ts">
import { computed } from 'vue'

import { useTextContentBindingProvider } from '@open-pencil/vue/controls/binding-provider'
import { BindableValueRoot } from '@open-pencil/vue/primitives/BindableValue'

import FieldBindingPicker from '@/components/properties/binding/FieldBindingPicker.vue'

/** What binds a text layer's content: its component's text properties, or a text or number variable. */
const { nodeId, text } = defineProps<{ nodeId: string; text: string }>()

const provider = useTextContentBindingProvider()
const targets = computed(() => [{ nodeId, path: 'text' }])
</script>

<template>
  <BindableValueRoot :provider="provider" :targets="targets" :value="text">
    <FieldBindingPicker :node-id="nodeId" field="TEXT" />
  </BindableValueRoot>
</template>
