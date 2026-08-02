<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { ref } from 'vue'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger
} from 'reka-ui'

import { useI18n } from '@open-pencil/vue'

import type { StorageDocument } from '@/app/integrations/storage'
import { storageDocumentIconUrls } from '@/app/storage/document-icons'
import { useMenuUI } from '@/components/ui/menu'
import TrashIcon from '@/components/storage/TrashIcon.vue'

const {
  document,
  thumbnailUrl,
  trashView = false,
  busy = false
} = defineProps<{
  document: StorageDocument
  thumbnailUrl?: string
  trashView?: boolean
  busy?: boolean
}>()

const emit = defineEmits<{
  open: [document: StorageDocument]
  rename: [document: StorageDocument]
  duplicate: [document: StorageDocument]
  trash: [document: StorageDocument]
  restore: [document: StorageDocument]
  deletePermanently: [document: StorageDocument]
  thumbnailNeeded: [document: StorageDocument]
}>()

const { dialogs } = useI18n()
const menuCls = useMenuUI({
  content: 'min-w-44',
  item: 'justify-start gap-2'
})
const card = ref<HTMLElement | null>(null)
let thumbnailRequested = false

useIntersectionObserver(
  card,
  ([entry]) => {
    if (!entry?.isIntersecting || thumbnailUrl || thumbnailRequested) return
    thumbnailRequested = true
    emit('thumbnailNeeded', document)
  },
  { rootMargin: '240px' }
)

function openDocument(): void {
  if (!trashView && !busy) emit('open', document)
}
</script>

<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child>
      <div
        ref="card"
        role="button"
        :tabindex="trashView || busy ? -1 : 0"
        :aria-disabled="trashView || busy"
        :aria-label="document.name"
        class="group overflow-hidden rounded-lg border border-border bg-panel text-left hover:border-panel-focus hover:bg-hover"
        :class="busy && 'pointer-events-none opacity-60'"
        :data-document-id="document.id"
        @click="openDocument"
        @keydown.enter="openDocument"
        @keydown.space.prevent="openDocument"
      >
        <div
          class="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-panel-field"
          data-slot="storage-thumbnail"
        >
          <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="" class="size-full object-cover" />
          <icon-lucide-presentation v-else class="size-5 text-muted/50" />
          <img
            :src="storageDocumentIconUrls[document.sourceFormat]"
            alt=""
            class="absolute top-1 left-1 size-3.5 rounded-[2px]"
            data-slot="storage-format-badge"
            :data-format="document.sourceFormat"
          />
        </div>
        <div class="border-t border-border p-3">
          <p class="truncate text-xs font-medium">{{ document.name }}</p>
          <p class="mt-1 text-[10px] text-muted">
            {{ new Date(document.trashedAt ?? document.updatedAt).toLocaleString() }}
          </p>
        </div>
      </div>
    </ContextMenuTrigger>

    <ContextMenuPortal>
      <ContextMenuContent :class="menuCls.content" :side-offset="2" align="start">
        <template v-if="trashView">
          <ContextMenuItem
            data-test-id="storage-context-restore"
            :class="menuCls.item"
            @select="emit('restore', document)"
          >
            <icon-lucide-rotate-ccw :class="menuCls.icon" />
            <span>{{ dialogs.storageRestore }}</span>
          </ContextMenuItem>
          <ContextMenuSeparator :class="menuCls.separator" />
          <ContextMenuItem
            data-test-id="storage-context-delete-permanently"
            :class="[menuCls.item, 'text-danger']"
            @select="emit('deletePermanently', document)"
          >
            <TrashIcon :class="menuCls.icon" />
            <span>{{ dialogs.storageDeletePermanently }}</span>
          </ContextMenuItem>
        </template>
        <template v-else>
          <ContextMenuItem
            data-test-id="storage-context-rename"
            :class="menuCls.item"
            @select="emit('rename', document)"
          >
            <icon-lucide-pencil :class="menuCls.icon" />
            <span>{{ dialogs.storageRename }}</span>
          </ContextMenuItem>
          <ContextMenuItem
            data-test-id="storage-context-duplicate"
            :class="menuCls.item"
            @select="emit('duplicate', document)"
          >
            <icon-lucide-copy :class="menuCls.icon" />
            <span>{{ dialogs.storageDuplicate }}</span>
          </ContextMenuItem>
          <ContextMenuSeparator :class="menuCls.separator" />
          <ContextMenuItem
            data-test-id="storage-context-trash"
            :class="[menuCls.item, 'text-danger']"
            @select="emit('trash', document)"
          >
            <TrashIcon :class="menuCls.icon" />
            <span>{{ dialogs.storageMoveToTrash }}</span>
          </ContextMenuItem>
        </template>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
