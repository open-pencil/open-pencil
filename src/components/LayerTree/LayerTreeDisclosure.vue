<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import layerTreeTheme from '@/theme/layer-tree'

import { useLayerTreeUI } from './ui'

const { expanded, visible } = defineProps<{
  expanded: boolean
  visible: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const ui = useLayerTreeUI()
const layerTree = tv(layerTreeTheme)
const styles = computed(() => layerTree({ expanded }))
</script>

<template>
  <button
    v-if="visible"
    type="button"
    data-slot="disclosure"
    :data-expanded="expanded || undefined"
    :class="styles.disclosure({ class: ui?.disclosure })"
    @click.stop="emit('toggle')"
  >
    <icon-lucide-chevron-right class="size-3" />
  </button>
  <span
    v-else
    data-slot="disclosure-placeholder"
    :class="styles.disclosurePlaceholder({ class: ui?.disclosurePlaceholder })"
  />
</template>
