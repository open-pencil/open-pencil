<script setup lang="ts">
import { computed, ref } from 'vue'

import type { SceneNode } from '@open-pencil/core/scene-graph'
import { useI18n } from '@open-pencil/vue'

import { nodeIcon } from '@/app/editor/icons'
import { useEditorStore } from '@/app/editor/active-store'
import { useButtonUI } from '@/components/ui/button'
import { useInputUI } from '@/components/ui/input'
import Tip from '@/components/ui/Tip.vue'

type LocalAsset = {
  id: string
  name: string
  node: SceneNode
  componentId: string | null
  variants: Array<{ name: string; values: string[] }>
  variantCount: number
}

const editor = useEditorStore()
const { panels, commands } = useI18n()
const query = ref('')
const input = useInputUI({ size: 'sm' })
const insertButton = useButtonUI({ tone: 'ghost', size: 'iconSm' })

function sortByCanvasPosition(a: SceneNode, b: SceneNode) {
  return a.y - b.y || a.x - b.x || a.name.localeCompare(b.name)
}

function componentSetDefaultVariant(componentSet: SceneNode): SceneNode | null {
  const variants = componentSet.childIds
    .map((id) => editor.graph.getNode(id))
    .filter((node): node is SceneNode => node?.type === 'COMPONENT')
    .sort(sortByCanvasPosition)
  return variants[0] ?? null
}

function componentSetVariantInfo(componentSetId: string) {
  return [...editor.collectVariantOptions(componentSetId)].map(([name, values]) => ({
    name,
    values: [...values].sort((a, b) => a.localeCompare(b))
  }))
}

const graphNodes = computed(() => ({
  sceneVersion: editor.state.sceneVersion,
  nodes: [...editor.graph.nodes.values()]
}))

const assets = computed<LocalAsset[]>(() => {
  return graphNodes.value.nodes
    .filter((node) => node.type === 'COMPONENT' || node.type === 'COMPONENT_SET')
    .filter((node) => {
      if (node.type === 'COMPONENT_SET') return true
      const parent = node.parentId ? editor.graph.getNode(node.parentId) : null
      return parent?.type !== 'COMPONENT_SET'
    })
    .map((node) => {
      const defaultVariant = node.type === 'COMPONENT_SET' ? componentSetDefaultVariant(node) : node
      const variants = node.type === 'COMPONENT_SET' ? componentSetVariantInfo(node.id) : []
      return {
        id: node.id,
        name: node.name,
        node,
        componentId: defaultVariant?.id ?? null,
        variants,
        variantCount: node.type === 'COMPONENT_SET' ? node.childIds.length : 0
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})

const filteredAssets = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  if (!normalized) return assets.value
  return assets.value.filter((asset) => asset.name.toLowerCase().includes(normalized))
})

function insertionPoint(component: SceneNode) {
  const canvas = document.querySelector<HTMLElement>('[data-test-id="canvas-area"]')
  const rect = canvas?.getBoundingClientRect()
  const center = editor.screenToCanvas(
    (rect?.width ?? window.innerWidth) / 2,
    (rect?.height ?? window.innerHeight) / 2
  )
  return {
    x: center.x - component.width / 2,
    y: center.y - component.height / 2
  }
}

function insertAsset(asset: LocalAsset) {
  if (!asset.componentId) return
  const component = editor.graph.getNode(asset.componentId)
  if (!component) return
  const point = insertionPoint(component)
  editor.createInstanceFromComponent(
    asset.componentId,
    point.x,
    point.y,
    editor.state.enteredContainerId ?? editor.state.currentPageId
  )
  editor.requestRender()
}
</script>

<template>
  <section data-test-id="assets-panel" class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <header class="shrink-0 px-3 py-2 text-[11px] tracking-wider text-muted uppercase">
      {{ panels.assets }}
    </header>
    <div class="shrink-0 px-2 pb-2">
      <input
        v-model="query"
        data-test-id="assets-search"
        :class="input.base"
        type="search"
        placeholder="Search local components"
      />
    </div>

    <div class="scrollbar-thin flex-1 overflow-y-auto px-1 pb-2">
      <button
        v-for="asset in filteredAssets"
        :key="asset.id"
        data-test-id="asset-item"
        :data-asset-id="asset.id"
        class="group/asset flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-surface hover:bg-hover"
        @dblclick="insertAsset(asset)"
      >
        <component
          :is="nodeIcon(asset.node)"
          class="size-3.5 shrink-0 text-component"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1">
          <span data-test-id="asset-name" class="block truncate">{{ asset.name }}</span>
          <span
            v-if="asset.variants.length > 0"
            data-test-id="asset-variant-summary"
            class="mt-0.5 block truncate text-[10px] text-muted"
          >
            {{ asset.variantCount }} variants ·
            {{ asset.variants.map((variant) => variant.name).join(', ') }}
          </span>
        </span>
        <Tip :label="commands.createInstance">
          <span
            :class="insertButton.base"
            data-test-id="asset-insert"
            @pointerdown.stop
            @click.stop="insertAsset(asset)"
          >
            <icon-lucide-plus class="size-3" />
          </span>
        </Tip>
      </button>

      <div
        v-if="filteredAssets.length === 0"
        data-test-id="assets-empty"
        class="px-3 py-6 text-center text-xs text-muted"
      >
        No local components
      </div>
    </div>
  </section>
</template>
