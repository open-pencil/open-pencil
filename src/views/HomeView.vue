<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuTrigger
} from 'reka-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@open-pencil/vue'

import { formatCloudBytes } from '@/app/cloud/format-bytes'
import { cloudConnectionError } from '@/app/cloud/health'
import { useCloudHome } from '@/app/cloud/home/use'
import { uploadProgressByCanvas } from '@/app/cloud/sync'
import { fadeOutGlobalLoader } from '@/app/editor/canvas/loader-overlay'
import { openFileDialog } from '@/app/shell/menu/files'
import { confirmDialog, promptText } from '@/app/shell/prompts'
import { settingsDialogOpen } from '@/app/shell/settings-dialog'
import { toast } from '@/app/shell/ui'
import logoUrl from '@/assets/openpencil-logo.svg'
import SettingsDialog from '@/components/Settings/SettingsDialog.vue'
import { useMenuUI } from '@/components/ui/menu'
import {
  createCloudCanvasInTab,
  importLocalFilesToCloud,
  type CloudImportProgress
} from '@/app/tabs'

const router = useRouter()
const { dialogs } = useI18n()
const {
  canvases,
  loading,
  error,
  syncWarning,
  statusMessage,
  refresh,
  deleteCanvas,
  downloadCanvas,
  duplicateCanvas,
  renameCanvas
} = useCloudHome()

/** CSS width for the badge progress fill while this canvas uploads. */
function uploadFillWidth(id: string): string | null {
  const fraction = uploadProgressByCanvas.value.get(id)
  return fraction == null ? null : `${Math.round(fraction * 100)}%`
}

function syncBadgeLabel(status: string | null | undefined): string | null {
  if (status === 'pending') return dialogs.value.cloudSyncPending
  if (status === 'error') return dialogs.value.cloudSyncError
  if (status === 'conflict') return dialogs.value.cloudSyncConflict
  return null
}

const menuCls = useMenuUI({ content: 'min-w-36 shadow-[0_8px_30px_rgb(0_0_0/0.4)]' })
const busy = ref(false)
const uploading = ref(false)
const uploadProgress = ref<CloudImportProgress | null>(null)
/** Smooth display % — creeps during long network PUT so we never jump to 90% and freeze. */
const uploadDisplayPercent = ref(0)
const dragOver = ref(false)
let dragDepth = 0
let creepTimer: ReturnType<typeof setInterval> | null = null

const uploadStepLabel = computed(() => {
  const d = dialogs.value
  const p = uploadProgress.value
  if (!p) return d.cloudUploading
  if (p.phase === 'converting') return d.cloudUploadConverting
  if (p.phase === 'reading') return d.cloudUploadReading
  return d.cloudUploadUploading
})

const uploadFileLabel = computed(() => uploadProgress.value?.fileName ?? '')

const uploadCountLabel = computed(() => {
  const p = uploadProgress.value
  if (!p) return ''
  const size =
    p.byteLength != null && p.byteLength > 0 ? ` · ${formatCloudBytes(p.byteLength)}` : ''
  return `File ${p.current} of ${p.total}${size}`
})

const isUploadNetworkPhase = computed(() => uploadProgress.value?.phase === 'uploading')

const uploadWaitHint = computed(() => {
  const p = uploadProgress.value
  const bytes = p?.byteLength ?? 0
  // ~27MB took ~3 min on a typical uplink — set expectations for large figs.
  if (p?.phase === 'uploading' && bytes >= 5 * 1024 * 1024) {
    return dialogs.value.cloudUploadLargeFileHint
  }
  return dialogs.value.cloudUploadPleaseWait
})

function stopCreep() {
  if (creepTimer != null) {
    clearInterval(creepTimer)
    creepTimer = null
  }
}

/**
 * Floor/ceiling for the current file slice within the batch (0–100 overall).
 * Reading/converting stay low; uploading creeps slowly toward the end of the slice.
 */
function sliceBounds(p: CloudImportProgress): { floor: number; ceiling: number } {
  const slice = 100 / Math.max(1, p.total)
  const sliceStart = ((p.current - 1) / Math.max(1, p.total)) * 100
  if (p.phase === 'reading') {
    return { floor: sliceStart + slice * 0.02, ceiling: sliceStart + slice * 0.12 }
  }
  if (p.phase === 'converting') {
    return { floor: sliceStart + slice * 0.12, ceiling: sliceStart + slice * 0.28 }
  }
  // Uploading: most of the real time is here — animate almost the whole rest of the slice.
  return { floor: sliceStart + slice * 0.28, ceiling: sliceStart + slice * 0.96 }
}

/** Creep cadence by file size: big uploads take minutes — advance slower. */
function creepPace(mb: number): { tickMs: number; rate: number } {
  if (mb >= 10) return { tickMs: 800, rate: 0.018 }
  if (mb >= 2) return { tickMs: 400, rate: 0.03 }
  return { tickMs: 250, rate: 0.045 }
}

function applyProgress(p: CloudImportProgress) {
  uploadProgress.value = { ...p }
  const { floor, ceiling } = sliceBounds(p)
  stopCreep()

  if (p.phase === 'uploading') {
    // Start at the upload floor; creep asymptotically toward ceiling while PUT runs.
    // Large files (tens of MB) can take minutes — creep more slowly so we don't sit at 90%.
    const mb = (p.byteLength ?? 0) / (1024 * 1024)
    const { tickMs, rate } = creepPace(mb)
    uploadDisplayPercent.value = Math.max(uploadDisplayPercent.value, Math.round(floor))
    creepTimer = setInterval(() => {
      const cur = uploadDisplayPercent.value
      const gap = ceiling - cur
      if (gap <= 0.4) return
      // Slow approach — never hits 100% until we finish.
      uploadDisplayPercent.value = Math.min(ceiling, cur + Math.max(0.12, gap * rate))
    }, tickMs)
    return
  }

  // Reading / converting: move to floor immediately, light creep within short phase range.
  uploadDisplayPercent.value = Math.max(uploadDisplayPercent.value, Math.round(floor))
  creepTimer = setInterval(() => {
    const cur = uploadDisplayPercent.value
    const gap = ceiling - cur
    if (gap <= 0.3) return
    uploadDisplayPercent.value = Math.min(ceiling, cur + Math.max(0.5, gap * 0.12))
  }, 120)
}

function finishUploadProgress() {
  stopCreep()
  uploadDisplayPercent.value = 100
}

onUnmounted(() => {
  stopCreep()
})

onMounted(() => {
  // Boot #loader only dismisses via EditorCanvas onReady — home never mounts a canvas.
  fadeOutGlobalLoader()
  void refresh()
})

async function onNewCanvas() {
  if (busy.value) return
  busy.value = true
  try {
    const id = await createCloudCanvasInTab('Untitled')
    await router.push(`/edit/cloud/${id}`)
  } catch (e) {
    console.warn('[Cloud home] create canvas failed:', e)
  } finally {
    busy.value = false
  }
}

async function onOpenCanvas(id: string) {
  await router.push(`/edit/cloud/${id}`)
}

async function onOpenLocal() {
  await openFileDialog()
  // ?local=1 lets /edit open while cloud is configured (see router beforeEnter).
  await router.push({ path: '/edit', query: { local: '1' } })
}

async function onDelete(id: string, name: string) {
  // In-app dialog: native confirm() is a silent no-op in the Tauri webview
  const ok = await confirmDialog(`Delete “${name}”? This cannot be undone.`, {
    confirmLabel: dialogs.value.deleteCanvas,
    danger: true
  })
  if (!ok) return
  try {
    await deleteCanvas(id)
  } catch (e) {
    console.error(e)
    toast.error(e instanceof Error ? e.message : String(e))
  }
}

async function onDownload(id: string, name: string) {
  try {
    await downloadCanvas(id, name)
  } catch (e) {
    console.error(e)
    toast.error(e instanceof Error ? e.message : String(e))
  }
}

async function onDuplicate(id: string) {
  if (busy.value) return
  busy.value = true
  try {
    await duplicateCanvas(id)
  } catch (e) {
    console.error(e)
    toast.error(e instanceof Error ? e.message : String(e))
  } finally {
    busy.value = false
  }
}

async function onRename(id: string, current: string) {
  const next = await promptText(dialogs.value.renameCanvas, current)
  if (next == null || next.trim() === '' || next.trim() === current) return
  try {
    await renameCanvas(id, next.trim())
  } catch (e) {
    console.error(e)
    toast.error(e instanceof Error ? e.message : String(e))
  }
}

function formatEdited(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function isFileDrag(e: DragEvent): boolean {
  const types = e.dataTransfer?.types
  if (!types) return false
  return [...types].includes('Files')
}

function onDragEnter(e: DragEvent) {
  if (!isFileDrag(e)) return
  e.preventDefault()
  dragDepth += 1
  dragOver.value = true
}

function onDragLeave(e: DragEvent) {
  if (!isFileDrag(e)) return
  e.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragOver.value = false
}

function onDragOver(e: DragEvent) {
  if (!isFileDrag(e)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  dragOver.value = true
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  dragDepth = 0
  dragOver.value = false
  if (busy.value || loading.value || uploading.value) return

  const list = e.dataTransfer?.files
  if (!list || list.length === 0) return

  const files = [...list]
  busy.value = true
  uploading.value = true
  uploadDisplayPercent.value = 0
  // Immediate first frame so the blocking overlay paints before heavy work.
  applyProgress({
    current: 1,
    total: Math.max(1, files.length),
    fileName: files[0]?.name ?? 'file',
    phase: 'reading'
  })
  try {
    await importLocalFilesToCloud(files, (progress) => {
      applyProgress(progress)
    })
    finishUploadProgress()
    // Brief moment at 100% so completion is visible.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 280)
    })
    await refresh()
  } catch (err) {
    console.warn('[Cloud home] drop import failed:', err)
  } finally {
    stopCreep()
    busy.value = false
    uploading.value = false
    uploadProgress.value = null
    uploadDisplayPercent.value = 0
  }
}
</script>

<template>
  <div
    data-test-id="cloud-home"
    class="relative flex h-screen w-screen flex-col bg-canvas text-surface"
  >
    <!-- Blocking upload overlay (drag-drop import) -->
    <div
      v-if="uploading"
      class="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/55 backdrop-blur-[2px]"
      data-test-id="cloud-home-upload-overlay"
    >
      <div
        class="flex w-80 max-w-[90vw] flex-col items-center gap-3 rounded-xl border border-border bg-panel px-6 py-6 shadow-2xl"
      >
        <icon-lucide-cloud-upload class="size-10 text-accent" />
        <p class="text-base font-semibold text-surface">{{ uploadStepLabel }}</p>
        <p v-if="uploadFileLabel" class="max-w-full truncate text-sm text-muted">
          {{ uploadFileLabel }}
        </p>
        <p class="text-sm font-medium text-surface">{{ uploadCountLabel }}</p>
        <div class="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-surface/15">
          <div
            class="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            :style="{ width: `${Math.round(uploadDisplayPercent)}%` }"
          />
          <!-- Extra motion while the network PUT is in flight -->
          <div
            v-if="isUploadNetworkPhase"
            class="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
          >
            <div
              class="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-white/25"
            />
          </div>
        </div>
        <p class="text-xs tabular-nums text-muted">{{ Math.round(uploadDisplayPercent) }}%</p>
        <p class="text-center text-[11px] text-muted">{{ uploadWaitHint }}</p>
      </div>
    </div>

    <header class="flex items-center justify-between border-b border-border px-6 py-4">
      <div class="flex items-center gap-5">
        <h1 class="flex items-center">
          <img :src="logoUrl" :alt="`OpenPencil — ${dialogs.cloudHomeTitle}`" class="h-8 w-auto" />
        </h1>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-hover disabled:opacity-50"
            data-test-id="cloud-home-open-local"
            :disabled="uploading"
            @click="onOpenLocal"
          >
            {{ dialogs.openLocalFile }}
          </button>
          <button
            type="button"
            class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            data-test-id="cloud-home-new"
            :disabled="busy || loading || uploading"
            @click="onNewCanvas"
          >
            {{ dialogs.newCanvas }}
          </button>
        </div>
      </div>
      <SettingsDialog />
    </header>

    <main
      class="relative flex min-h-0 flex-1 flex-col overflow-auto p-6"
      data-test-id="cloud-home-dropzone"
      @dragenter="onDragEnter"
      @dragleave="onDragLeave"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <div
        v-if="dragOver && !uploading"
        class="pointer-events-none absolute inset-3 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent bg-accent/10"
        data-test-id="cloud-home-drop-overlay"
      >
        <icon-lucide-upload class="size-8 text-accent" />
        <p class="text-sm font-medium text-surface">{{ dialogs.cloudDropImport }}</p>
        <p class="text-[11px] text-muted">{{ dialogs.cloudDropImportHint }}</p>
      </div>

      <div
        v-if="loading"
        class="flex flex-1 flex-col items-center justify-center gap-3"
        data-test-id="cloud-home-loading"
      >
        <icon-lucide-cloud class="size-8 text-muted opacity-70" />
        <div class="h-0.5 w-28 overflow-hidden rounded-full bg-surface/10">
          <div
            class="h-full w-2/5 animate-[slide_1s_ease-in-out_infinite] rounded-full bg-surface/30"
          />
        </div>
        <p class="text-sm text-muted">{{ statusMessage ?? dialogs.cloudHomeLoading }}</p>
        <p class="text-[11px] text-muted/80">{{ dialogs.cloudHomeLoadingHint }}</p>
      </div>

      <!-- A configured-but-unreachable cloud (syncWarning) must not masquerade
           as an empty library — surface it and point at Settings, where the
           actionable details (CORS help, Test connection) live. -->
      <div
        v-else-if="(error || syncWarning) && canvases.length === 0"
        class="mx-auto mt-10 w-full max-w-xl rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
        data-test-id="cloud-home-error"
      >
        <p class="font-medium">{{ dialogs.cloudLoadFailed }}</p>
        <p v-if="error" class="mt-1 text-xs opacity-90">{{ error }}</p>
        <p v-else class="mt-1 text-xs opacity-90">
          {{ dialogs.cloudConnectionLostHint }}
          <button
            type="button"
            class="cursor-pointer underline underline-offset-2 hover:text-red-300"
            data-test-id="cloud-home-open-settings"
            @click="settingsDialogOpen = true"
          >
            {{ dialogs.cloudConnectionLostSettingsLink }}</button
          >.
        </p>
        <button
          type="button"
          class="mt-3 rounded border border-border px-2 py-1 text-xs hover:bg-hover"
          @click="refresh"
        >
          {{ dialogs.refresh }}
        </button>
      </div>

      <div
        v-else-if="canvases.length === 0"
        class="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center"
        data-test-id="cloud-home-empty"
      >
        <icon-lucide-upload class="size-8 text-muted opacity-50" />
        <p class="text-sm text-muted">{{ dialogs.noCanvasesYet }}</p>
        <p class="max-w-xs text-[11px] text-muted">{{ dialogs.cloudDropImportHint }}</p>
        <button
          type="button"
          class="rounded-md bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent/90"
          @click="onNewCanvas"
        >
          {{ dialogs.createFirstCanvas }}
        </button>
      </div>

      <div
        v-if="syncWarning && canvases.length > 0"
        class="mb-3 rounded-lg border border-border bg-panel/80 px-3 py-2 text-[11px] text-muted"
        data-test-id="cloud-home-sync-warning"
      >
        {{ dialogs.cloudSyncOfflineHint }} · {{ syncWarning }}
      </div>

      <ul
        v-if="canvases.length > 0"
        class="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4"
        data-test-id="cloud-home-grid"
      >
        <li v-for="canvas in canvases" :key="canvas.id">
          <ContextMenuRoot :modal="false">
            <ContextMenuTrigger as-child>
              <button
                type="button"
                class="group flex w-full flex-col overflow-hidden rounded-lg border border-border bg-panel text-left transition hover:border-accent/50 hover:shadow-sm"
                :data-test-id="`cloud-canvas-card-${canvas.id}`"
                @click="onOpenCanvas(canvas.id)"
              >
                <div
                  class="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#2c2c2c] text-2xl text-muted"
                >
                  <img
                    v-if="canvas.thumbnailUrl"
                    :src="canvas.thumbnailUrl"
                    :alt="canvas.name"
                    class="h-full w-full object-cover"
                    draggable="false"
                  />
                  <icon-lucide-file-image v-else class="size-8 opacity-40" />
                  <span
                    v-if="syncBadgeLabel(canvas.syncStatus)"
                    class="absolute right-1.5 top-1.5 overflow-hidden rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur-sm"
                    data-test-id="cloud-canvas-sync-badge"
                  >
                    <!-- badge background doubles as the upload progress bar -->
                    <span
                      v-if="uploadFillWidth(canvas.id)"
                      class="absolute inset-y-0 left-0 bg-accent/80 transition-[width] duration-300 ease-out"
                      :style="{ width: uploadFillWidth(canvas.id) ?? '0%' }"
                      data-test-id="cloud-canvas-sync-fill"
                    />
                    <span class="relative">{{ syncBadgeLabel(canvas.syncStatus) }}</span>
                  </span>
                </div>
                <div class="flex flex-col gap-0.5 p-2.5">
                  <span class="truncate text-xs font-medium">{{ canvas.name }}</span>
                  <span class="text-[10px] text-muted">{{ formatEdited(canvas.updatedAt) }}</span>
                  <!-- pointer-events gated with visibility: while invisible this row
                   must not be an invisible click-trap over the card button -->
                  <div
                    class="pointer-events-none mt-1 flex gap-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100"
                  >
                    <span
                      class="text-[10px] text-muted hover:text-surface"
                      role="button"
                      tabindex="0"
                      @click.stop="onRename(canvas.id, canvas.name)"
                    >
                      {{ dialogs.renameCanvas }}
                    </span>
                    <span
                      class="text-[10px] text-red-400 hover:text-red-300"
                      role="button"
                      tabindex="0"
                      @click.stop="onDelete(canvas.id, canvas.name)"
                    >
                      {{ dialogs.deleteCanvas }}
                    </span>
                  </div>
                </div>
              </button>
            </ContextMenuTrigger>
            <ContextMenuPortal>
              <ContextMenuContent
                :class="menuCls.content"
                :side-offset="2"
                align="start"
                :data-test-id="`cloud-canvas-menu-${canvas.id}`"
              >
                <ContextMenuItem
                  :class="menuCls.item"
                  data-test-id="cloud-canvas-menu-open"
                  @select="onOpenCanvas(canvas.id)"
                >
                  <icon-lucide-external-link :class="menuCls.icon" />
                  <span>{{ dialogs.openCanvas }}</span>
                </ContextMenuItem>
                <ContextMenuItem
                  :class="menuCls.item"
                  data-test-id="cloud-canvas-menu-rename"
                  @select="onRename(canvas.id, canvas.name)"
                >
                  <icon-lucide-pencil :class="menuCls.icon" />
                  <span>{{ dialogs.renameCanvas }}</span>
                </ContextMenuItem>
                <ContextMenuItem
                  :class="menuCls.item"
                  data-test-id="cloud-canvas-menu-duplicate"
                  @select="onDuplicate(canvas.id)"
                >
                  <icon-lucide-copy :class="menuCls.icon" />
                  <span>{{ dialogs.duplicateCanvas }}</span>
                </ContextMenuItem>
                <ContextMenuItem
                  :class="menuCls.item"
                  data-test-id="cloud-canvas-menu-download"
                  @select="onDownload(canvas.id, canvas.name)"
                >
                  <icon-lucide-download :class="menuCls.icon" />
                  <span>{{ dialogs.downloadCanvas }}</span>
                </ContextMenuItem>
                <ContextMenuItem
                  :class="menuCls.item"
                  class="text-red-400 data-[highlighted]:text-red-300"
                  data-test-id="cloud-canvas-menu-delete"
                  @select="onDelete(canvas.id, canvas.name)"
                >
                  <icon-lucide-trash-2 :class="menuCls.icon" />
                  <span>{{ dialogs.deleteCanvas }}</span>
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenuPortal>
          </ContextMenuRoot>
        </li>
      </ul>
    </main>

    <footer
      class="flex shrink-0 items-center gap-2 border-t border-border px-6 py-1.5 text-[11px] text-muted"
      data-test-id="cloud-home-footer"
    >
      <span
        class="size-1.5 shrink-0 rounded-full"
        :class="cloudConnectionError ? 'bg-red-500' : 'bg-emerald-500'"
      />
      <span>{{
        cloudConnectionError ? dialogs.cloudConnectionFailed : dialogs.cloudWorkspaceActive
      }}</span>
    </footer>
  </div>
</template>
