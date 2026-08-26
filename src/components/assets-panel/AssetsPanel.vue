<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger,
  DialogClose,
  DialogTitle
} from 'reka-ui'

import type { SceneNode } from '@open-pencil/scene-graph'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'
import { useI18n } from '@open-pencil/vue'

import { nodeIcon } from '@/app/editor/icons'
import { useEditorStore } from '@/app/editor/active-store'
import { useLibraryService } from '@/app/libraries'
import { openExternalLink } from '@/app/shell/ui'
import LibraryManagerDialog from '@/components/libraries/LibraryManagerDialog.vue'
import { useLibraryEntry } from '@/components/libraries/useLibraryEntry'
import AssetThumbnail from '@/components/assets-panel/AssetThumbnail.vue'
import { findAssetPage } from '@/components/assets-panel/page'
import AppInput from '@/components/ui/AppInput.vue'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { AppDialogRoot, useDialogUI } from '@/components/ui/dialog'
import { useMenuUI } from '@/components/ui/menu'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import Tip from '@/components/ui/Tip.vue'
import { ASSET_GRID_THUMBNAIL_SIZE, ASSET_LIST_THUMBNAIL_SIZE } from '@/constants'

type AssetView = 'grid' | 'list'

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
  docsURL: string | null
  libraryId: string | null
  revisionId: string | null
  assetKey: string | null
  libraryName: string | null
  pageId: string
  pageName: string
}

type AssetGroup = {
  pageId: string
  pageName: string
  assets: LocalAsset[]
}

const editor = useEditorStore()
const libraryService = useLibraryService()
const remoteAssets = libraryService.enabledAssets
const { panels, commands } = useI18n()
const query = ref('')
const assetView = ref<AssetView>('grid')
const detailsOpen = ref(false)
const {
  open: librariesOpen,
  initialSection: libraryInitialSection,
  updateCount: libraryUpdateCount,
  openManager: openLibraries
} = useLibraryEntry(editor, libraryService)
const selectedAssetId = ref<string | null>(null)
const previewBlob = shallowRef<Blob | null>(null)
const previewURL = useObjectUrl(previewBlob)
const previewLoading = ref(false)
const insertingAssetId = ref<string | null>(null)
let previewRequestId = 0
const insertButton = {
  color: 'neutral' as const,
  variant: 'ghost' as const,
  size: 'sm' as const,
  shape: 'square' as const
}
const primaryButton = { color: 'primary' as const, variant: 'solid' as const, size: 'md' as const }
const dialog = useDialogUI()
const contextMenu = useMenuUI({ content: 'min-w-44' })
const viewOptions = computed(() => [
  { value: 'grid', label: panels.value.gridView },
  { value: 'list', label: panels.value.listView }
])
const viewUI = { root: 'w-16', item: 'px-1' }

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

const assetNodes = computed(() =>
  graphNodes.value.nodes.filter(
    (node) => node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'
  )
)

const pageByNodeId = computed(() => {
  const pages = new Map<string, { id: string; name: string }>()
  for (const node of assetNodes.value) {
    const page = findAssetPage(node, editor.graph)
    if (page) pages.set(node.id, { id: page.id, name: page.name })
  }
  return pages
})

const assets = computed<LocalAsset[]>(() => {
  const local = assetNodes.value
    .filter((node) => !node.librarySource?.readOnly)
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
      const page = pageByNodeId.value.get(node.id)
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
        docsURL: node.symbolLinks[0]?.uri ?? null,
        libraryId: null,
        revisionId: null,
        assetKey: null,
        libraryName: null,
        pageId: page?.id ?? editor.state.currentPageId,
        pageName: page?.name ?? panels.value.page
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  const remote = remoteAssets.value.map(({ libraryId, libraryName, revisionId, asset }) => ({
    id: `${libraryId}:${asset.key}`,
    name: asset.name,
    node: createDefaultNode(() => asset.sourceNodeId, asset.type, {
      name: asset.name,
      symbolDescription: asset.description,
      sourceLibraryKey: asset.key
    }),
    componentId: null,
    variants: [],
    variantCount: 0,
    hasConflicts: false,
    sourceLibraryKey: asset.key,
    description: asset.description,
    docsURL: null,
    libraryId,
    revisionId,
    assetKey: asset.key,
    libraryName,
    pageId: `library:${libraryId}`,
    pageName: libraryName
  }))
  return [...local, ...remote]
})

const filteredAssets = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  if (!normalized) return assets.value
  return assets.value.filter((asset) => asset.name.toLowerCase().includes(normalized))
})

const assetGroups = computed<AssetGroup[]>(() => {
  const groups = new Map<string, AssetGroup>()
  for (const asset of filteredAssets.value) {
    const group = groups.get(asset.pageId) ?? {
      pageId: asset.pageId,
      pageName: asset.pageName,
      assets: []
    }
    group.assets.push(asset)
    groups.set(asset.pageId, group)
  }
  return [...groups.values()].sort((a, b) => a.pageName.localeCompare(b.pageName))
})

const selectedAsset = computed(
  () => assets.value.find((asset) => asset.id === selectedAssetId.value) ?? null
)
const selectedPreviewNodeId = computed(() => selectedAsset.value?.componentId ?? null)

onMounted(() => {
  void libraryService.refresh(editor)
})

function clearPreview() {
  previewBlob.value = null
}

async function updatePreview() {
  const requestId = ++previewRequestId
  const nodeId = selectedPreviewNodeId.value
  if (!detailsOpen.value || !nodeId) {
    clearPreview()
    return
  }

  const node = editor.getNode(nodeId)
  if (!node) {
    clearPreview()
    return
  }

  previewLoading.value = true
  try {
    const maxSize = Math.max(node.width, node.height, 1)
    const scale = Math.min(176 / maxSize, 2)
    const data = await editor.renderExportImage([nodeId], scale, 'PNG', selectedAsset.value?.pageId)
    if (requestId !== previewRequestId) return
    previewBlob.value = data ? new Blob([data], { type: 'image/png' }) : null
  } catch {
    if (requestId === previewRequestId) clearPreview()
  } finally {
    if (requestId === previewRequestId) previewLoading.value = false
  }
}

watch([detailsOpen, selectedPreviewNodeId, () => editor.state.sceneVersion], updatePreview, {
  flush: 'post'
})

function openDetails(asset: LocalAsset) {
  selectedAssetId.value = asset.id
  detailsOpen.value = true
}

function insertionPoint(component: SceneNode, parentId: string) {
  const canvasCenter = editor.viewportCanvasCenter()
  const center = editor.screenToCanvas(canvasCenter.x, canvasCenter.y)
  const parentOffset =
    parentId === editor.state.currentPageId
      ? { x: 0, y: 0 }
      : editor.graph.getAbsolutePosition(parentId)
  return {
    x: center.x - parentOffset.x - component.width / 2,
    y: center.y - parentOffset.y - component.height / 2
  }
}

async function resolveAssetComponent(asset: LocalAsset): Promise<string | null> {
  if (asset.componentId) return asset.componentId
  if (!asset.libraryId || !asset.revisionId || !asset.assetKey) return null
  insertingAssetId.value = asset.id
  try {
    const result = await libraryService.materialize(
      editor,
      asset.libraryId,
      asset.revisionId,
      asset.assetKey
    )
    return result.componentId
  } finally {
    insertingAssetId.value = null
  }
}

async function insertAsset(asset: LocalAsset) {
  const componentId = await resolveAssetComponent(asset)
  if (!componentId) return
  const component = editor.graph.getNode(componentId)
  if (!component) return
  const parentId = editor.state.enteredContainerId ?? editor.state.currentPageId
  const point = insertionPoint(component, parentId)
  editor.createInstanceFromComponent(componentId, point.x, point.y, parentId)
  editor.requestRender()
}

function onDragStart(event: DragEvent, asset: LocalAsset) {
  if (!event.dataTransfer || !asset.componentId) return
  event.dataTransfer.setData('application/x-openpencil-component', asset.componentId)
  event.dataTransfer.effectAllowed = 'copy'
}

function focusAsset(asset: LocalAsset) {
  if (asset.libraryId) return
  void editor.focusComponent(asset.id)
}

function onAssetKeydown(event: KeyboardEvent, asset: LocalAsset) {
  if ((event.metaKey || event.ctrlKey) && event.code === 'Enter') {
    event.preventDefault()
    openDetails(asset)
    return
  }
  if (event.code === 'Enter' || event.code === 'Space') {
    event.preventDefault()
    void insertAsset(asset)
  }
}

async function insertSelectedAsset() {
  if (!selectedAsset.value) return
  await insertAsset(selectedAsset.value)
  detailsOpen.value = false
}
</script>

<template>
  <section data-test-id="assets-panel" class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="flex shrink-0 items-center gap-2 px-2 py-2">
      <AppInput
        v-model="query"
        type="search"
        data-test-id="assets-search"
        size="sm"
        class="min-w-0 flex-1"
        :placeholder="panels.searchLocalComponents"
      />
      <AppButton
        v-bind="insertButton"
        class="relative"
        :aria-label="libraryUpdateCount > 0 ? panels.reviewLibraryUpdates : panels.manageLibraries"
        @click="openLibraries"
      >
        <icon-lucide-library class="size-3.5" />
        <span
          v-if="libraryUpdateCount > 0"
          class="absolute top-0.5 right-0.5 min-w-2.5 rounded-full bg-accent px-0.5 text-center text-[8px] leading-2.5 text-white"
        >
          {{ libraryUpdateCount }}
        </span>
      </AppButton>
      <SegmentedControl
        v-model="assetView"
        data-test-id="assets-view-toggle"
        :options="viewOptions"
        :label="panels.assetView"
        :ui="viewUI"
      >
        <template #option="{ option }">
          <icon-lucide-layout-grid v-if="option.value === 'grid'" class="size-3" />
          <icon-lucide-list v-else class="size-3" />
        </template>
      </SegmentedControl>
    </div>

    <div class="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
      <section v-for="group in assetGroups" :key="group.pageId" class="mb-3">
        <h2 class="mb-1 px-1 text-[10px] font-medium tracking-wide text-muted uppercase">
          {{ group.pageName }}
        </h2>
        <div :class="assetView === 'grid' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-0.5'">
          <ContextMenuRoot v-for="asset in group.assets" :key="asset.id">
            <ContextMenuTrigger as-child>
              <div
                role="button"
                tabindex="0"
                data-test-id="asset-item"
                :data-asset-id="asset.id"
                :draggable="!!asset.componentId"
                :aria-busy="insertingAssetId === asset.id"
                :class="[
                  'group/asset rounded text-left text-xs text-surface outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-accent',
                  assetView === 'grid'
                    ? 'flex min-w-0 flex-col items-center gap-1 p-1.5'
                    : 'flex w-full items-center gap-2 px-1.5 py-1'
                ]"
                @click="openDetails(asset)"
                @keydown="onAssetKeydown($event, asset)"
                @dragstart="onDragStart($event, asset)"
              >
                <AssetThumbnail
                  v-if="asset.componentId"
                  :node-id="asset.componentId"
                  :alt="`${asset.name} preview`"
                  :size="
                    assetView === 'grid' ? ASSET_GRID_THUMBNAIL_SIZE : ASSET_LIST_THUMBNAIL_SIZE
                  "
                />
                <component
                  :is="nodeIcon(asset.node)"
                  v-else
                  class="size-4 shrink-0 text-component"
                  aria-hidden="true"
                />
                <span :class="assetView === 'grid' ? 'w-full min-w-0' : 'min-w-0 flex-1'">
                  <span class="flex min-w-0 items-center gap-1">
                    <span data-test-id="asset-name" class="truncate">{{ asset.name }}</span>
                    <span
                      v-if="asset.sourceLibraryKey"
                      data-test-id="asset-library-badge"
                      class="shrink-0 rounded bg-component/15 px-1 py-px text-[9px] font-medium text-component uppercase"
                    >
                      {{ panels.assetLibraryBadge }}
                    </span>
                  </span>
                  <span
                    v-if="assetView === 'list' && asset.variants.length > 0"
                    data-test-id="asset-variant-summary"
                    class="mt-0.5 block truncate text-[10px] text-muted"
                  >
                    {{
                      panels.assetVariantSummary({
                        count: asset.variantCount,
                        names: asset.variants.map((variant) => variant.name).join(', ')
                      })
                    }}
                  </span>
                  <span
                    v-if="assetView === 'list' && asset.description"
                    data-test-id="asset-description"
                    class="mt-0.5 block truncate text-[10px] text-muted"
                  >
                    {{ asset.description }}
                  </span>
                  <span
                    v-if="assetView === 'list' && asset.hasConflicts"
                    data-test-id="asset-variant-conflict"
                    class="mt-0.5 block truncate text-[10px] text-[var(--color-warning-text)]"
                  >
                    {{ panels.duplicateVariantValues }}
                  </span>
                </span>
                <div v-if="assetView === 'list'" class="flex shrink-0 items-center">
                  <Tip v-if="asset.docsURL" :label="panels.openDocumentation">
                    <AppButton
                      v-bind="insertButton"
                      data-test-id="asset-docs"
                      @pointerdown.stop
                      @click.stop="asset.docsURL ? openExternalLink(asset.docsURL) : undefined"
                    >
                      <icon-lucide-book-open class="size-3" />
                    </AppButton>
                  </Tip>
                  <Tip :label="commands.createInstance">
                    <AppButton
                      v-bind="insertButton"
                      data-test-id="asset-insert"
                      :disabled="insertingAssetId === asset.id"
                      @pointerdown.stop
                      @click.stop="insertAsset(asset)"
                    >
                      <icon-lucide-plus class="size-3" />
                    </AppButton>
                  </Tip>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuPortal>
              <ContextMenuContent :class="contextMenu.content">
                <ContextMenuItem
                  v-if="!asset.libraryId"
                  data-test-id="asset-context-go-to-main"
                  :class="contextMenu.item"
                  @select="focusAsset(asset)"
                >
                  {{ panels.goToMainComponent }}
                </ContextMenuItem>
                <ContextMenuItem
                  data-test-id="asset-context-view-details"
                  :class="contextMenu.item"
                  @select="openDetails(asset)"
                >
                  {{ panels.viewDetails }}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenuPortal>
          </ContextMenuRoot>
        </div>
      </section>

      <AppPlaceholder
        v-if="filteredAssets.length === 0"
        data-test-id="assets-empty"
        :label="panels.noLocalComponents"
        size="compact"
      >
        <template #icon>
          <icon-lucide-component class="size-4" />
        </template>
      </AppPlaceholder>
    </div>

    <LibraryManagerDialog v-model="librariesOpen" :initial-section="libraryInitialSection" />

    <AppDialogRoot
      v-if="selectedAsset"
      v-model:open="detailsOpen"
      size="lg"
      data-test-id="asset-details-dialog"
    >
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <div class="flex min-w-0 items-center gap-2">
          <component :is="nodeIcon(selectedAsset.node)" class="size-4 shrink-0 text-component" />
          <div class="min-w-0">
            <DialogTitle :class="dialog.title" class="truncate">{{
              selectedAsset.name
            }}</DialogTitle>
            <p class="mt-0.5 text-[11px] text-muted">
              {{
                selectedAsset.node.type === 'COMPONENT_SET' ? panels.componentSet : panels.component
              }}
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
              v-if="previewURL"
              data-test-id="asset-details-preview-image"
              :src="previewURL"
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
          <AppButton
            v-bind="primaryButton"
            data-test-id="asset-details-insert"
            class="mt-3 w-full"
            @click="insertSelectedAsset"
          >
            {{ panels.insertInstance }}
          </AppButton>
        </div>

        <div class="min-w-0 p-4">
          <section v-if="selectedAsset.description" class="mb-4">
            <h3 class="text-[11px] font-medium tracking-wider text-muted uppercase">
              {{ panels.description }}
            </h3>
            <p data-test-id="asset-details-description" class="mt-1 text-xs leading-5 text-surface">
              {{ selectedAsset.description }}
            </p>
          </section>

          <section v-if="selectedAsset.sourceLibraryKey" class="mb-4">
            <h3 class="text-[11px] font-medium tracking-wider text-muted uppercase">
              {{ panels.assetLibraryBadge }}
            </h3>
            <p data-test-id="asset-details-library" class="mt-1 break-all text-xs text-muted">
              {{ selectedAsset.sourceLibraryKey }}
            </p>
          </section>

          <section v-if="selectedAsset.docsURL" class="mb-4">
            <h3 class="text-[11px] font-medium tracking-wider text-muted uppercase">
              {{ panels.documentation }}
            </h3>
            <AppButton
              color="primary"
              variant="link"
              size="xs"
              data-test-id="asset-details-docs"
              class="mt-1"
              @click="selectedAsset.docsURL ? openExternalLink(selectedAsset.docsURL) : undefined"
            >
              <icon-lucide-book-open class="size-3" />
              {{ panels.openDocs }}
            </AppButton>
          </section>

          <section v-if="selectedAsset.variants.length > 0">
            <h3 class="text-[11px] font-medium tracking-wider text-muted uppercase">
              {{ panels.properties }}
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
    </AppDialogRoot>
  </section>
</template>
