<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { computed, ref } from 'vue'
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
import { uploadProgressByCanvas } from '@/app/storage/sync'
import type { StorageDocumentLocationBadge } from '@/app/storage/visibility'
import { useMenuUI } from '@/components/ui/menu'
import Tip from '@/components/ui/Tip.vue'
import TrashIcon from '@/components/storage/TrashIcon.vue'

const {
  document,
  thumbnailUrl,
  syncError = null,
  thumbnailError = null,
  conflicted = false,
  trashView = false,
  busy = false,
  unavailable = false,
  targetLabel = '',
  location = null
} = defineProps<{
  document: StorageDocument
  thumbnailUrl?: string
  /** Verbatim provider text for a failed body/metadata sync. */
  syncError?: string | null
  /** Verbatim provider text for a failed preview upload. Cosmetic only. */
  thumbnailError?: string | null
  /** The remote moved underneath a pending local edit — resolution is a click away. */
  conflicted?: boolean
  trashView?: boolean
  busy?: boolean
  /**
   * No copy on this device and none at the target either, so there is nothing
   * to open. Say so on the card instead of letting the click fail: the row is
   * otherwise indistinguishable from a working document.
   *
   * Not a deletion, and never treated as one — the target may simply be
   * mid-replacement. The caller recomputes this from each listing, so the card
   * returns to normal on its own once the document is listed again.
   */
  unavailable?: boolean
  /** Human name of the destination, for the unavailable explanation. */
  targetLabel?: string
  /**
   * Where this document lives, already resolved to a sentence.
   *
   * An attribute of the document, never a reason to hide it: the workspace
   * lists every row on the device and the badge says which destination — if
   * any — holds a copy.
   */
  location?: StorageDocumentLocationBadge | null
}>()

const emit = defineEmits<{
  open: [document: StorageDocument]
  rename: [document: StorageDocument]
  duplicate: [document: StorageDocument]
  trash: [document: StorageDocument]
  restore: [document: StorageDocument]
  deletePermanently: [document: StorageDocument]
  resolveConflict: [document: StorageDocument]
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

const interactive = computed(() => !trashView && !busy && !unavailable)

function openDocument(): void {
  if (interactive.value) emit('open', document)
}

const unavailableDetail = computed(() =>
  dialogs.value.storageDocumentUnavailableDetail({ target: targetLabel })
)

/** A destination holds a copy — cloud icon; otherwise the device holds it alone. */
const locationIsReplicated = computed(
  () => location?.kind === 'backed-up-here' || location?.kind === 'backed-up-elsewhere'
)

/** Real byte progress (0..1) while this document's body is uploading. */
const uploadProgress = computed(() => uploadProgressByCanvas.value.get(document.id) ?? null)

/**
 * Show a bar whenever work is in flight. Determinate for uploads, where the
 * adapter reports transferred bytes; indeterminate for everything else
 * (rename, duplicate, trash, metadata sync) which has no measurable size.
 */
const showSyncBar = computed(() => uploadProgress.value !== null || busy)
const isDeterminate = computed(() => uploadProgress.value !== null)
</script>

<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child>
      <div
        ref="card"
        role="button"
        :tabindex="interactive ? 0 : -1"
        :aria-disabled="!interactive"
        :aria-label="document.name"
        class="group relative overflow-hidden rounded-lg border border-border bg-panel text-left hover:border-panel-focus hover:bg-hover"
        :class="[busy && 'pointer-events-none opacity-60', unavailable && 'cursor-not-allowed']"
        :data-document-id="document.id"
        :data-unavailable="unavailable ? '' : undefined"
        @click="openDocument"
        @keydown.enter="openDocument"
        @keydown.space.prevent="openDocument"
      >
        <!--
          16:9 to match what the previews actually are: slides are 1920x1080 and
          both renderers emit 400x225. A 4:3 well cropped the sides off every
          deck, taking the title with them.
        -->
        <div
          class="relative flex aspect-video items-center justify-center overflow-hidden bg-panel-field"
          data-slot="storage-thumbnail"
        >
          <!--
            `contain`, not `cover`: a preview exists to show what the document
            is, and cropping to fill the well is what hid the headline. A
            document whose page is not 16:9 letterboxes against the well rather
            than losing its edges.
          -->
          <img
            v-if="thumbnailUrl"
            :src="thumbnailUrl"
            alt=""
            class="size-full object-contain"
            :class="unavailable && 'opacity-40 grayscale'"
          />
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
          <!--
            Where the document lives, stated on every card. This is the answer
            to "will my next edit reach a durable copy?" — asked and answered
            per document, which hiding the row answers never.
          -->
          <p
            v-if="location"
            class="mt-1 flex items-center gap-1 text-[10px] text-muted"
            data-slot="storage-document-location"
            :data-location="location.kind"
          >
            <icon-lucide-cloud-upload
              v-if="location.kind === 'backing-up'"
              class="size-3 shrink-0"
            />
            <icon-lucide-cloud v-else-if="locationIsReplicated" class="size-3 shrink-0" />
            <icon-lucide-hard-drive v-else class="size-3 shrink-0" />
            <span class="truncate">{{ location.label }}</span>
          </p>
          <!--
            Neither an error nor a deletion: the document is simply not
            reachable from here right now. The tooltip names the destination and
            says so plainly, because the alarming reading — "my document is
            gone" — is the wrong one while a replacement may be in flight.
          -->
          <Tip v-if="unavailable" :label="unavailableDetail">
            <p
              class="mt-1 flex items-center gap-1 text-[10px] text-muted"
              data-slot="storage-document-unavailable"
            >
              <icon-lucide-cloud-off class="size-3 shrink-0" />
              <span class="truncate">{{ dialogs.storageDocumentUnavailable }}</span>
            </p>
          </Tip>
          <!--
            Not a failure: the destination is fine, the remote just moved.
            Clicking opens the resolution dialog — the one state on a card
            with its own action.
          -->
          <button
            v-if="conflicted"
            type="button"
            class="mt-1 flex items-center gap-1 text-[10px] text-[var(--color-warning-text)] hover:underline"
            data-slot="storage-document-conflict"
            @click.stop="emit('resolveConflict', document)"
          >
            <icon-lucide-git-pull-request-arrow class="size-3 shrink-0" />
            <span class="truncate">{{ dialogs.storageDocumentConflict }}</span>
          </button>
          <!--
            The provider's own words are the tooltip, not a paraphrase: the
            label says which layer failed, the message says what to fix.
          -->
          <Tip v-if="syncError" :label="syncError">
            <p
              class="mt-1 flex items-center gap-1 text-[10px] text-danger"
              data-slot="storage-sync-error"
            >
              <icon-lucide-circle-alert class="size-3 shrink-0" />
              <span class="truncate">{{ dialogs.storageDocumentSyncFailed }}</span>
            </p>
          </Tip>
          <!--
            Deliberately quieter than the body error and never mutually
            exclusive with it: a stale preview says nothing about the document.
          -->
          <Tip v-if="thumbnailError" :label="thumbnailError">
            <p
              class="mt-1 flex items-center gap-1 text-[10px] text-muted"
              data-slot="storage-thumbnail-error"
            >
              <icon-lucide-image-off class="size-3 shrink-0" />
              <span class="truncate">{{ dialogs.storageDocumentPreviewNotSynced }}</span>
            </p>
          </Tip>
        </div>

        <div
          v-if="showSyncBar"
          class="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-accent/15"
          data-slot="storage-sync-progress"
          role="progressbar"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :aria-valuenow="isDeterminate ? Math.round((uploadProgress ?? 0) * 100) : undefined"
          :aria-label="dialogs.storageSyncing"
        >
          <div
            v-if="isDeterminate"
            class="h-full bg-accent transition-[width] duration-200 ease-out"
            :style="{ width: `${(uploadProgress ?? 0) * 100}%` }"
          />
          <div v-else class="h-full w-2/5 animate-[slide_1s_ease-in-out_infinite] bg-accent" />
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
          <!--
            Duplicating reads the body, which is exactly what cannot be
            reached — offering it would only reproduce the failed open under a
            different name. Rename and Trash stay: both are metadata-only, and
            Trash is the one way out of a row the user has decided is dead.
          -->
          <ContextMenuItem
            v-if="!unavailable"
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
