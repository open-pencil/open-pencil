<script setup lang="ts">
import { useElementVisibility, useObjectUrl } from '@vueuse/core'
import { shallowRef, useTemplateRef, watch } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'

const { nodeId, alt, size } = defineProps<{
  nodeId: string
  alt: string
  size: 40 | 96
}>()

const THUMBNAIL_RENDER_SCALE = 2

const editor = useEditorStore()
const thumbnail = useTemplateRef<HTMLElement>('thumbnail')
const isVisible = useElementVisibility(thumbnail)
const previewBlob = shallowRef<Blob | null>(null)
const previewUrl = useObjectUrl(previewBlob)
let requestId = 0

function pageIdForNode(node: SceneNode): string {
  let current: SceneNode | undefined = node
  while (current && current.type !== 'CANVAS') {
    current = current.parentId ? editor.graph.getNode(current.parentId) : undefined
  }
  return current?.id ?? editor.state.currentPageId
}

async function updatePreview() {
  const currentRequest = ++requestId
  const node = editor.graph.getNode(nodeId)
  if (!node) {
    previewBlob.value = null
    return
  }

  const maxDimension = Math.max(node.width, node.height, 1)
  const scale = (size * THUMBNAIL_RENDER_SCALE) / maxDimension
  const data = await editor.renderExportImage([nodeId], scale, 'PNG', pageIdForNode(node))
  if (currentRequest !== requestId) return
  previewBlob.value = data ? new Blob([data], { type: 'image/png' }) : null
}

watch(
  () => [nodeId, size, editor.state.sceneVersion, isVisible.value],
  ([, , , visible]) => {
    if (visible) void updatePreview()
  },
  { immediate: true, flush: 'post' }
)
</script>

<template>
  <div
    ref="thumbnail"
    data-slot="asset-thumbnail"
    :class="[
      'flex shrink-0 items-center justify-center overflow-hidden rounded bg-canvas/60',
      size === 96 ? 'size-24' : 'size-10'
    ]"
  >
    <img
      v-if="previewUrl"
      :src="previewUrl"
      :alt="alt"
      class="max-h-full max-w-full object-contain"
      draggable="false"
    />
    <icon-lucide-component v-else class="size-4 text-component" aria-hidden="true" />
  </div>
</template>
