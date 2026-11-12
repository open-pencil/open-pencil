<script setup lang="ts">
import { useI18n } from '@open-pencil/vue/i18n'

import { useToolNodes } from '@/components/chat/tool/useToolNodes'

import { chatToolNodesTheme } from './ui'

const { ids } = defineProps<{ ids: string[] }>()
const { ai } = useI18n()
const ui = chatToolNodesTheme()
const { nodes, show } = useToolNodes(() => ids)
</script>

<template>
  <div v-if="nodes.length" :class="ui.root()" data-slot="chat-tool-nodes">
    <button
      v-for="node in nodes"
      :key="node.id"
      type="button"
      :class="ui.node()"
      :disabled="!node.present"
      :aria-label="ai.showNodeOnCanvas({ name: node.label })"
      @click="void show(node.id)"
    >
      <icon-lucide-crosshair :class="ui.icon()" aria-hidden="true" />
      <span :class="ui.label()">{{ node.label }}</span>
    </button>
  </div>
</template>
