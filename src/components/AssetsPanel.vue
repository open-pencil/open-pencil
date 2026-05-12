<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'

import type { SceneNode } from '@open-pencil/core/scene-graph'
import { useI18n } from '@open-pencil/vue'

import { nodeIcon } from '@/app/editor/icons'
import { useEditorStore } from '@/app/editor/active-store'
import { openExternalLink } from '@/app/shell/ui'
import { useButtonUI } from '@/components/ui/button'
import { useDialogUI } from '@/components/ui/dialog'
import { useInputUI } from '@/components/ui/input'
import Tip from '@/components/ui/Tip.vue'

type LocalAsset = {
  id: string
  name: string
  node: SceneNode
  componentId: string | null
  variants: Array<{ name: string; values: string[] }>
  variantCount: number
  hasConflicts: boolean
  sourceLibraryKey: string | null
  description: string
  docsUrl: string | null
}

const editor = useEditorStore()
const { panels, commands } = useI18n()
const query = ref('')
const detailsOpen = ref(false)
const selectedAssetId = ref<string | null>(null)
const previewUrl = ref<string | null>(null)
const previewLoading = ref(false)
let previewRequestId = 0
const input = useInputUI({ size: 'sm' })
const insertButton = useButtonUI({ tone: 'ghost', size: 'iconSm' })
const primaryButton = useButtonUI({ tone: 'accent', size: 'md' })
const dialog = useDialogUI({ content: 'flex w-[720px] max-w-[92vw] flex-col overflow-hidden' })

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
      const defaultVariant =
        node.type === 'COMPONENT_SET' ? editor.getDefaultVariantForComponentSet(node.id) : node
      const conflicts =
        node.type === 'COMPONENT_SET' ? editor.getComponentSetVariantConflicts(node.id) : []
      const variants = node.type === 'COMPONENT_SET' ? componentSetVariantInfo(node.id) : []
      return {
        id: node.id,
        name: node.name,
        node,
        componentId: defaultVariant?.id ?? null,
        variants,
        variantCount: node.type === 'COMPONENT_SET' ? node.childIds.length : 0,
        hasConflicts: conflicts.length > 0,
        sourceLibraryKey: node.sourceLibraryKey,
        description: node.symbolDescription,
        docsUrl: node.symbolLinks[0]?.uri ?? null
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})

const filteredAssets = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  if (!normalized) return assets.value
  return assets.value.filter((asset) => asset.name.toLowerCase().includes(normalized))
})

const selectedAsset = computed(
  () => assets.value.find((asset) => asset.id === selectedAssetId.value) ?? null
)
const selectedPreviewNodeId = computed(() => selectedAsset.value?.componentId ?? null)

function revokePreview() {
  if (!previewUrl.value) return
  URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
}

async function updatePreview() {
  const requestId = ++previewRequestId
  const nodeId = selectedPreviewNodeId.value
  if (!detailsOpen.value || !nodeId) {
    revokePreview()
    return
  }

  const node = editor.getNode(nodeId)
  if (!node) {
    revokePreview()
    return
  }

  previewLoading.value = true
  try {
    const maxSize = Math.max(node.width, node.height, 1)
    const scale = Math.min(176 / maxSize, 2)
    const data = await editor.renderExportImage([nodeId], scale, 'PNG')
    if (requestId !== previewRequestId) return
    revokePreview()
    if (data) previewUrl.value = URL.createObjectURL(new Blob([data], { type: 'image/png' }))
  } finally {
    if (requestId === previewRequestId) previewLoading.value = false
  }
}

watch([detailsOpen, selectedPreviewNodeId, () => editor.state.sceneVersion], updatePreview, {
  flush: 'post'
})

onScopeDispose(revokePreview)

function openDetails(asset: LocalAsset) {
  selectedAssetId.value = asset.id
  detailsOpen.value = true
}

function insertionPoint(component: SceneNode, parentId: string) {
  const canvas = document.querySelector<HTMLElement>('[data-test-id="canvas-area"]')
  const rect = canvas?.getBoundingClientRect()
  const center = editor.screenToCanvas(
    (rect?.width ?? window.innerWidth) / 2,
    (rect?.height ?? window.innerHeight) / 2
  )
  const parentOffset =
    parentId === editor.state.currentPageId
      ? { x: 0, y: 0 }
      : editor.graph.getAbsolutePosition(parentId)
  return {
    x: center.x - parentOffset.x - component.width / 2,
    y: center.y - parentOffset.y - component.height / 2
  }
}

function insertAsset(asset: LocalAsset) {
  if (!asset.componentId) return
  const component = editor.graph.getNode(asset.componentId)
  if (!component) return
  const parentId = editor.state.enteredContainerId ?? editor.state.currentPageId
  const point = insertionPoint(component, parentId)
  editor.createInstanceFromComponent(asset.componentId, point.x, point.y, parentId)
  editor.requestRender()
}

function insertSelectedAsset() {
  if (!selectedAsset.value) return
  insertAsset(selectedAsset.value)
  detailsOpen.value = false
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
        @click="openDetails(asset)"
        @dblclick="insertAsset(asset)"
      >
        <component
          :is="nodeIcon(asset.node)"
          class="size-3.5 shrink-0 text-component"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1">
          <span class="flex min-w-0 items-center gap-1.5">
            <span data-test-id="asset-name" class="truncate">{{ asset.name }}</span>
            <span
              v-if="asset.sourceLibraryKey"
              data-test-id="asset-library-badge"
              class="shrink-0 rounded bg-component/15 px-1 py-px text-[9px] font-medium text-component uppercase"
            >
              Library
            </span>
          </span>
          <span
            v-if="asset.variants.length > 0"
            data-test-id="asset-variant-summary"
            class="mt-0.5 block truncate text-[10px] text-muted"
          >
            {{ asset.variantCount }} variants ·
            {{ asset.variants.map((variant) => variant.name).join(', ') }}
          </span>
          <span
            v-if="asset.description"
            data-test-id="asset-description"
            class="mt-0.5 block truncate text-[10px] text-muted"
          >
            {{ asset.description }}
          </span>
          <span
            v-if="asset.hasConflicts"
            data-test-id="asset-variant-conflict"
            class="mt-0.5 block truncate text-[10px] text-[var(--color-warning-text)]"
          >
            Duplicate variant values
          </span>
        </span>
        <Tip v-if="asset.docsUrl" label="Open documentation">
          <span
            :class="insertButton.base"
            data-test-id="asset-docs"
            @pointerdown.stop
            @dblclick.stop
            @click.stop="asset.docsUrl ? openExternalLink(asset.docsUrl) : undefined"
          >
            <icon-lucide-book-open class="size-3" />
          </span>
        </Tip>
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

    <DialogRoot v-model:open="detailsOpen">
      <DialogPortal>
        <DialogOverlay :class="dialog.overlay" />
        <DialogContent
          v-if="selectedAsset"
          data-test-id="asset-details-dialog"
          :class="dialog.content"
        >
          <div class="flex items-center justify-between border-b border-border px-4 py-3">
            <div class="flex min-w-0 items-center gap-2">
              <component
                :is="nodeIcon(selectedAsset.node)"
                class="size-4 shrink-0 text-component"
              />
              <div class="min-w-0">
                <DialogTitle :class="dialog.title" class="truncate">{{
                  selectedAsset.name
                }}</DialogTitle>
                <p class="mt-0.5 text-[11px] text-muted">
                  {{ selectedAsset.node.type === 'COMPONENT_SET' ? 'Component set' : 'Component' }}
                  <span v-if="selectedAsset.variantCount > 0">
                    · {{ selectedAsset.variantCount }} variants</span
                  >
                </p>
              </div>
            </div>
            <DialogClose
              data-test-id="asset-details-close"
              class="flex size-7 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
            >
              <icon-lucide-x class="size-4" />
            </DialogClose>
          </div>

          <div class="grid min-h-0 grid-cols-[260px_1fr] gap-0">
            <div class="border-r border-border p-4">
              <div
                data-test-id="asset-details-preview"
                class="flex h-36 items-center justify-center overflow-hidden rounded-lg border border-border bg-canvas/60"
              >
                <img
                  v-if="previewUrl"
                  data-test-id="asset-details-preview-image"
                  :src="previewUrl"
                  :alt="`${selectedAsset.name} preview`"
                  class="max-h-[120px] max-w-[210px] object-contain"
                />
                <div v-else class="text-center">
                  <icon-lucide-loader-2
                    v-if="previewLoading"
                    class="mx-auto size-5 animate-spin text-muted"
                  />
                  <component
                    v-else
                    :is="nodeIcon(selectedAsset.node)"
                    class="mx-auto size-8 text-component"
                  />
                  <p class="mt-2 max-w-44 truncate text-xs font-medium text-surface">
                    {{ selectedAsset.name }}
                  </p>
                </div>
              </div>
              <button
                data-test-id="asset-details-insert"
                :class="primaryButton.base"
                class="mt-3 w-full"
                @click="insertSelectedAsset"
              >
                Insert instance
              </button>
            </div>

            <div class="min-w-0 p-4">
              <section v-if="selectedAsset.description" class="mb-4">
                <h3 class="text-[11px] font-medium tracking-wider text-muted uppercase">
                  Description
                </h3>
                <p
                  data-test-id="asset-details-description"
                  class="mt-1 text-xs leading-5 text-surface"
                >
                  {{ selectedAsset.description }}
                </p>
              </section>

              <section v-if="selectedAsset.sourceLibraryKey" class="mb-4">
                <h3 class="text-[11px] font-medium tracking-wider text-muted uppercase">Library</h3>
                <p data-test-id="asset-details-library" class="mt-1 break-all text-xs text-muted">
                  {{ selectedAsset.sourceLibraryKey }}
                </p>
              </section>

              <section v-if="selectedAsset.docsUrl" class="mb-4">
                <h3 class="text-[11px] font-medium tracking-wider text-muted uppercase">
                  Documentation
                </h3>
                <button
                  data-test-id="asset-details-docs"
                  class="mt-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-component hover:bg-component/10"
                  @click="
                    selectedAsset.docsUrl ? openExternalLink(selectedAsset.docsUrl) : undefined
                  "
                >
                  <icon-lucide-book-open class="size-3" />
                  Open docs
                </button>
              </section>

              <section v-if="selectedAsset.variants.length > 0">
                <h3 class="text-[11px] font-medium tracking-wider text-muted uppercase">
                  Properties
                </h3>
                <div class="mt-2 flex flex-col gap-2">
                  <div
                    v-for="variant in selectedAsset.variants"
                    :key="variant.name"
                    data-test-id="asset-details-property"
                    class="rounded border border-border bg-input/40 px-2 py-1.5"
                  >
                    <div class="text-xs font-medium text-surface">{{ variant.name }}</div>
                    <div class="mt-1 text-[11px] text-muted">{{ variant.values.join(', ') }}</div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </section>
</template>
