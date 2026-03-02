<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '@/stores/editor'

const store = useEditorStore()

const zoomPct = computed(() => Math.round(store.state.zoom * 100))

const STEP = -22 // applyZoom: Math.pow(0.99, -22) ≈ 1.25 (zoom in)

function zoomIn() {
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  store.applyZoom(STEP, cx, cy)
}

function zoomOut() {
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  store.applyZoom(-STEP, cx, cy)
}

function zoomReset() {
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  // same math as applyZoom but targets zoom=1 exactly
  const factor = 1 / store.state.zoom
  store.state.panX = cx - (cx - store.state.panX) * factor
  store.state.panY = cy - (cy - store.state.panY) * factor
  store.state.zoom = 1
}
</script>

<template>
  <div class="pointer-events-auto flex items-center gap-px rounded-lg border border-border bg-panel px-1 py-1 shadow-md">
    <!-- Zoom out -->
    <button
      class="flex size-6 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
      title="Zoom out (Cmd -)"
      @click="zoomOut"
    >
      <icon-lucide-minus class="size-3" />
    </button>

    <!-- Zoom level -->
    <button
      class="min-w-[42px] rounded px-1.5 py-0.5 text-center text-[11px] tabular-nums text-surface transition-colors hover:bg-hover"
      title="Reset to 100%"
      @click="zoomReset"
    >
      {{ zoomPct }}%
    </button>

    <!-- Zoom in -->
    <button
      class="flex size-6 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
      title="Zoom in (Cmd +)"
      @click="zoomIn"
    >
      <icon-lucide-plus class="size-3" />
    </button>

    <div class="mx-0.5 h-3.5 w-px bg-border" />

    <!-- Fit all -->
    <button
      class="flex size-6 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
      title="Zoom to fit (Shift 1)"
      @click="store.zoomToFit()"
    >
      <icon-lucide-maximize-2 class="size-3" />
    </button>

    <!-- Zoom to selection -->
    <button
      class="flex size-6 items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
      title="Zoom to selection (Shift 2)"
      @click="store.zoomToSelection()"
    >
      <icon-lucide-focus class="size-3" />
    </button>
  </div>
</template>
