<script setup lang="ts">
import { computed, ref } from 'vue'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'

import { useComponentThumbnails } from '@/composables/use-component-thumbnails'
import { useEditorStore } from '@/stores/editor'

import AssetItem from './AssetItem.vue'
import ImageAssetItem from './ImageAssetItem.vue'

import type { SceneNode } from '@open-pencil/core'

const store = useEditorStore()
const query = ref('')

const allGroups = computed(() => {
  void store.state.sceneVersion
  return store.graph.getComponentsGroupedByPage()
})

const allComponentIds = computed(() => {
  const ids: string[] = []
  for (const group of allGroups.value) {
    for (const comp of group.components) {
      ids.push(comp.id)
      if (comp.type === 'COMPONENT_SET') {
        for (const child of store.graph.getChildren(comp.id)) {
          if (child.type === 'COMPONENT') ids.push(child.id)
        }
      }
    }
  }
  return ids
})

const thumbnails = useComponentThumbnails(store, allComponentIds)

const totalComponents = computed(() =>
  allGroups.value.reduce((sum, g) => sum + g.components.length, 0)
)

const imageUsages = computed(() => {
  void store.state.sceneVersion
  return store.graph.getImageUsages()
})

const imageList = computed(() => {
  const list: Array<{ hash: string; nodeIds: string[]; names: string[]; url: string }> = []
  for (const entry of imageUsages.value.values()) {
    const url = store.imageBlobUrl(entry.hash)
    if (url) list.push({ ...entry, url })
  }
  return list
})

const filteredGroups = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (!q) return allGroups.value

  const result: Array<{ page: SceneNode; components: SceneNode[] }> = []
  for (const group of allGroups.value) {
    const filtered = group.components.filter((comp) => {
      if (comp.name.toLowerCase().includes(q)) return true
      if (comp.type === 'COMPONENT_SET') {
        return store.graph
          .getChildren(comp.id)
          .some((c) => c.type === 'COMPONENT' && c.name.toLowerCase().includes(q))
      }
      return false
    })
    if (filtered.length > 0) result.push({ page: group.page, components: filtered })
  }
  return result
})

const filteredImages = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (!q) return imageList.value
  return imageList.value.filter((img) => img.names.some((n) => n.toLowerCase().includes(q)))
})

const hasAnyAssets = computed(() => totalComponents.value > 0 || imageList.value.length > 0)
const hasFilteredResults = computed(
  () => filteredGroups.value.length > 0 || filteredImages.value.length > 0
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
      <icon-lucide-search class="size-3 shrink-0 text-muted" />
      <input
        v-model="query"
        placeholder="Search assets..."
        class="min-w-0 flex-1 bg-transparent text-xs text-surface outline-none placeholder:text-muted"
      />
    </div>

    <div
      v-if="!hasAnyAssets"
      class="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center"
    >
      <icon-lucide-package class="size-8 text-muted" />
      <p class="text-xs text-muted">No assets</p>
      <p class="text-[10px] text-muted">Components: ⌥⌘K · Images: drag onto canvas</p>
    </div>

    <div
      v-else-if="query && !hasFilteredResults"
      class="flex flex-1 items-center justify-center px-4"
    >
      <p class="text-xs text-muted">No results for "{{ query }}"</p>
    </div>

    <div v-else class="scrollbar-thin flex-1 overflow-y-auto px-1 pb-1">
      <!-- Components section -->
      <CollapsibleRoot v-if="filteredGroups.length > 0" default-open>
        <CollapsibleTrigger
          class="flex w-full items-center gap-1.5 px-2 py-1.5 text-[11px] tracking-wider text-muted uppercase hover:text-surface"
        >
          <icon-lucide-chevron-down
            class="size-3 transition-transform [[data-state=closed]>&]:rotate-[-90deg]"
          />
          Components ({{ totalComponents }})
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CollapsibleRoot v-for="group in filteredGroups" :key="group.page.id" default-open>
            <CollapsibleTrigger
              class="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] tracking-wider text-muted hover:text-surface"
            >
              <icon-lucide-chevron-down
                class="size-2.5 transition-transform [[data-state=closed]>&]:rotate-[-90deg]"
              />
              {{ group.page.name }}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <template v-for="comp in group.components" :key="comp.id">
                <CollapsibleRoot v-if="comp.type === 'COMPONENT_SET'" default-open>
                  <AssetItem :node="comp" :thumbnail-url="thumbnails.get(comp.id)" is-set />
                  <CollapsibleContent>
                    <AssetItem
                      v-for="variant in store.graph
                        .getChildren(comp.id)
                        .filter((c) => c.type === 'COMPONENT')"
                      :key="variant.id"
                      :node="variant"
                      :thumbnail-url="thumbnails.get(variant.id)"
                      indented
                    />
                  </CollapsibleContent>
                </CollapsibleRoot>
                <AssetItem v-else :node="comp" :thumbnail-url="thumbnails.get(comp.id)" />
              </template>
            </CollapsibleContent>
          </CollapsibleRoot>
        </CollapsibleContent>
      </CollapsibleRoot>

      <!-- Images section -->
      <CollapsibleRoot v-if="filteredImages.length > 0" default-open>
        <CollapsibleTrigger
          class="flex w-full items-center gap-1.5 px-2 py-1.5 text-[11px] tracking-wider text-muted uppercase hover:text-surface"
        >
          <icon-lucide-chevron-down
            class="size-3 transition-transform [[data-state=closed]>&]:rotate-[-90deg]"
          />
          Images ({{ imageList.length }})
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ImageAssetItem
            v-for="img in filteredImages"
            :key="img.hash"
            :hash="img.hash"
            :names="img.names"
            :node-ids="img.nodeIds"
            :thumbnail-url="img.url"
          />
        </CollapsibleContent>
      </CollapsibleRoot>
    </div>
  </div>
</template>
