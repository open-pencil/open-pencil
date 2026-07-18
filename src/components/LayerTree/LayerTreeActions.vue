<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import { useI18n } from '@open-pencil/vue'

import Tip from '../ui/Tip.vue'
import { useLayerTreeUI } from './ui'

import layerTreeTheme from '@/theme/layer-tree'

import type { LayerNode } from '@open-pencil/vue'

const { node, selected } = defineProps<{
  node: LayerNode
  selected: boolean
}>()

const emit = defineEmits<{
  toggleLock: []
  toggleVisibility: []
}>()

const { menu: t } = useI18n()
const ui = useLayerTreeUI()
const layerTree = tv(layerTreeTheme)
const styles = computed(() => layerTree({ actionsVisible: node.locked || !node.visible }))
const lockStyles = computed(() => layerTree({ actionActive: node.locked }))
const visibilityStyles = computed(() => layerTree({ actionActive: !node.visible }))
</script>

<template>
  <span
    data-slot="actions"
    :data-selected="selected || undefined"
    :data-persistent="node.locked || !node.visible || undefined"
    :class="styles.actions({ class: ui?.actions })"
  >
    <Tip :label="node.locked ? t.unlock : t.lock">
      <button
        type="button"
        data-slot="action"
        :aria-label="node.locked ? t.unlock : t.lock"
        :class="styles.action({ class: ui?.action })"
        @pointerdown.stop
        @click.stop="emit('toggleLock')"
      >
        <icon-lucide-lock
          v-if="node.locked"
          data-slot="action-icon"
          :class="lockStyles.actionIcon({ class: ui?.actionIcon })"
        />
        <icon-lucide-unlock
          v-else
          data-slot="action-icon"
          :class="lockStyles.actionIcon({ class: ui?.actionIcon })"
        />
      </button>
    </Tip>
    <Tip :label="node.visible ? t.hide : t.show">
      <button
        type="button"
        data-slot="action"
        :aria-label="node.visible ? t.hide : t.show"
        :class="styles.action({ class: ui?.action })"
        @pointerdown.stop
        @click.stop="emit('toggleVisibility')"
      >
        <icon-lucide-eye-off
          v-if="!node.visible"
          data-slot="action-icon"
          :class="visibilityStyles.actionIcon({ class: ui?.actionIcon })"
        />
        <icon-lucide-eye
          v-else
          data-slot="action-icon"
          :class="visibilityStyles.actionIcon({ class: ui?.actionIcon })"
        />
      </button>
    </Tip>
  </span>
</template>
