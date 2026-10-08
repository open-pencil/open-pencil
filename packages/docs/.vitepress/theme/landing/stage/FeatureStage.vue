<script setup lang="ts">
import { useIntersectionObserver, useMediaQuery } from '@vueuse/core'
import { MotionConfig } from 'motion-v'
import { TooltipProvider } from 'reka-ui'
import { defineAsyncComponent, ref, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { STAGES } from './definitions'
import { prepareEngine } from './engine-assets'
import type { SingleStageKind } from './kinds'
import StageCanvas from './StageCanvas.vue'
import { useDocsAppearance } from './useDocsAppearance'
import { useStageDocument } from './useStageDocument'
import { useWheelEngagement } from './useWheelEngagement'

// Only some stages show the toolbar or the preview pill, so the others never download them.
const Toolbar = defineAsyncComponent(() => import('@/components/Toolbar/Toolbar.vue'))
const StagePreviewControls = defineAsyncComponent(() => import('./StagePreviewControls.vue'))

/** Stages mount a screen ahead of the viewport, so a block is live before it scrolls in. */
const MOUNT_MARGIN = '100% 0px'

const { kind } = defineProps<{ kind: SingleStageKind }>()
/** Its scene is on the canvas, so the page can take down the still it showed in its place. */
const emit = defineEmits<{ ready: [] }>()
const definition = STAGES[kind]

useDocsAppearance()
const { panels } = useI18n()
const { build, focus, ready } = useStageDocument(definition.scene)
watch(ready, () => emit('ready'), { once: true })
const { engage, disengage, guardWheel } = useWheelEngagement()

// A stage mounts once, as the visitor approaches it, and then stays mounted: its canvas and
// WebGL context are created a single time and never torn down while the page is open.
const root = ref<HTMLElement | null>(null)
const mounted = ref(false)
const { stop } = useIntersectionObserver(
  root,
  async ([entry]) => {
    if (!entry?.isIntersecting) return
    stop()
    await prepareEngine()
    mounted.value = true
    void build()
  },
  { rootMargin: MOUNT_MARGIN }
)

// Touch drags must scroll the page, so on touch devices the canvas is view-only.
const touch = useMediaQuery('(pointer: coarse)')
// The app's mobile toolbar is laid out for a full-screen canvas, not a card on a page.
const narrow = useMediaQuery('(max-width: 767px)')

function onPointerDown() {
  engage()
  focus()
}
</script>

<template>
  <MotionConfig reduced-motion="user">
    <TooltipProvider :delay-duration="400">
      <!-- Typography and selection behaviour the app sets on `body` in `src/app.css`. -->
      <div
        ref="root"
        class="op-app relative flex h-full overflow-hidden bg-canvas text-[13px] leading-normal text-surface select-none max-md:flex-col"
        @pointerdown.capture="onPointerDown"
        @focusin.capture="focus"
        @pointerleave="disengage"
        @wheel.capture="guardWheel"
      >
        <div
          data-poster-part="canvas"
          class="relative flex min-h-0 min-w-0 flex-1 bg-canvas"
          :class="touch && '*:pointer-events-none'"
        >
          <template v-if="mounted">
            <StageCanvas />
            <Toolbar v-if="definition.toolbar && !touch && !narrow" />
            <StagePreviewControls v-if="definition.preview" />
          </template>
        </div>

        <aside
          v-if="definition.panel"
          data-poster-part="panel"
          class="flex w-72 shrink-0 flex-col overflow-hidden border-l border-border bg-panel max-md:h-64 max-md:w-full max-md:border-t max-md:border-l-0"
        >
          <template v-if="mounted">
            <header
              v-if="definition.layersHeading"
              class="shrink-0 px-3 py-2 text-[11px] font-semibold text-surface"
            >
              {{ panels.layers }}
            </header>
            <component :is="definition.panel" v-bind="definition.panelProps" />
          </template>
        </aside>
      </div>
    </TooltipProvider>
  </MotionConfig>
</template>
