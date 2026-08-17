<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { shallowRef, watch } from 'vue'

import { renderNodesToImage } from '@open-pencil/core/io'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'

const { graph, nodeId, alt } = defineProps<{ graph: SceneGraph; nodeId: string; alt: string }>()
const editor = useEditorStore()
const blob = shallowRef<Blob | null>(null)
const url = useObjectUrl(blob)
let requestId = 0

watch(
  () => [graph, nodeId] as const,
  async () => {
    const request = ++requestId
    const renderer = editor.renderer
    const node = graph.getNode(nodeId)
    const page = graph.getPages()[0]
    if (!renderer || !node || !page) return
    const maxDimension = Math.max(node.width, node.height, 1)
    const data = await renderNodesToImage(renderer.ck, renderer, graph, page.id, [nodeId], {
      scale: 320 / maxDimension,
      format: 'PNG'
    })
    if (request === requestId) blob.value = data ? new Blob([data], { type: 'image/png' }) : null
  },
  { immediate: true }
)
</script>

<template>
  <img v-if="url" :src="url" :alt="alt" class="max-h-[60vh] max-w-[80%] object-contain" />
  <icon-lucide-loader-2 v-else class="size-5 animate-spin text-muted" />
</template>
