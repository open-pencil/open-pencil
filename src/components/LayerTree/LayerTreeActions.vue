<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'
import type { LayerNode } from '@open-pencil/vue'

import Tip from '../ui/overlay/Tip.vue'

const { node, ui } = defineProps<{
  node: LayerNode
  ui: { actions: string; action: string; lockIcon: string; visibilityIcon: string }
}>()

const emit = defineEmits<{
  toggleLock: []
  toggleVisibility: []
}>()

const { menu: t } = useI18n()
</script>

<template>
  <span
    data-slot="actions"
    :data-persistent="node.locked || !node.visible || undefined"
    :class="ui.actions"
  >
    <Tip :label="node.locked ? t.unlock : t.lock">
      <button
        type="button"
        data-slot="action"
        :aria-label="node.locked ? t.unlock : t.lock"
        :class="ui.action"
        @pointerdown.stop
        @click.stop="emit('toggleLock')"
      >
        <icon-lucide-lock v-if="node.locked" data-slot="action-icon" :class="ui.lockIcon" />
        <icon-lucide-unlock v-else data-slot="action-icon" :class="ui.lockIcon" />
      </button>
    </Tip>
    <Tip :label="node.visible ? t.hide : t.show">
      <button
        type="button"
        data-slot="action"
        :aria-label="node.visible ? t.hide : t.show"
        :class="ui.action"
        @pointerdown.stop
        @click.stop="emit('toggleVisibility')"
      >
        <icon-lucide-eye-off
          v-if="!node.visible"
          data-slot="action-icon"
          :class="ui.visibilityIcon"
        />
        <icon-lucide-eye v-else data-slot="action-icon" :class="ui.visibilityIcon" />
      </button>
    </Tip>
  </span>
</template>
