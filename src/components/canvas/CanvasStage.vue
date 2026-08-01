<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import EditorCanvas from '@/components/EditorCanvas.vue'
import Toolbar from '@/components/Toolbar/Toolbar.vue'
import PresentationOverlay from '@/components/presentation/PresentationOverlay.vue'
import presentationTheme from '@/theme/presentation'

const { presenting } = defineProps<{ presenting: boolean }>()

const presentationStyles = tv(presentationTheme)()

const dataPresenting = computed(() => (presenting ? 'true' : undefined))
const stageClass = computed(() =>
  presenting ? presentationStyles.stage() : 'relative flex min-w-0 flex-1'
)
const canvasHostClass = computed(() =>
  presenting ? presentationStyles.canvasHost() : 'contents'
)
</script>

<template>
  <!--
    Teleport relocates the canvas host without remounting EditorCanvas, so the two
    CanvasKit/WebGL surfaces survive enter/exit. Do not key this wrapper.
  -->
  <Teleport to="body" :disabled="!presenting">
    <div data-test-id="presentation-stage" :data-presenting="dataPresenting" :class="stageClass">
      <div :class="canvasHostClass">
        <div class="relative flex min-h-0 min-w-0 flex-1">
          <EditorCanvas />
          <Toolbar v-if="!presenting" />
        </div>
      </div>
      <PresentationOverlay v-if="presenting" />
    </div>
  </Teleport>
</template>
