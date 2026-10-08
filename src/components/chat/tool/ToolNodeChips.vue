<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import { useToolNodes } from '@/components/chat/tool/useToolNodes'
import { chatToolTheme } from '@/theme/chat/tool'

const { ids } = defineProps<{ ids: string[] }>()
const { ai } = useI18n()
const ui = chatToolTheme()
const { nodes, show } = useToolNodes(() => ids)
</script>

<template>
  <div v-if="nodes.length" :class="ui.nodes()" data-slot="chat-tool-nodes">
    <button
      v-for="node in nodes"
      :key="node.id"
      type="button"
      :class="ui.node()"
      :disabled="!node.present"
      :aria-label="ai.showNodeOnCanvas({ name: node.label })"
      @click="void show(node.id)"
    >
      <icon-lucide-crosshair :class="ui.nodeIcon()" aria-hidden="true" />
      <span :class="ui.nodeLabel()">{{ node.label }}</span>
    </button>
  </div>
</template>
