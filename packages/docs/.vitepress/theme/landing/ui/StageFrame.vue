<script setup lang="ts">
import { defineClientComponent, withBase } from 'vitepress'

import type { FeatureKind } from '../content/features'
import { useLandingMessages } from '../content/messages'

/** The editor needs WebGL and CanvasKit, so a stage never renders on the server. */
const FeatureStage = defineClientComponent(() => import('../stage/FeatureStage.vue'))
const CollabStage = defineClientComponent(() => import('../stage/collab/CollabStage.vue'))

const { kind } = defineProps<{ kind: FeatureKind }>()

const messages = useLandingMessages()
</script>

<template>
  <div class="stage-frame">
    <!-- Shown until the editor code arrives. It mirrors the app's canvas loading overlay,
         which takes over once the stage mounts on top of it. -->
    <div class="stage-loader" role="status" :aria-label="messages.loading">
      <img :src="withBase('/brand/app-icon.svg')" alt="" />
      <span />
    </div>
    <CollabStage v-if="kind === 'collab'" />
    <FeatureStage v-else :kind="kind" />
  </div>
</template>

<style scoped>
.stage-frame {
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
}

.stage-loader {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.stage-loader img {
  width: 48px;
  height: 48px;
}

.stage-loader span {
  position: relative;
  width: 100px;
  height: 2px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--vp-c-text-1) 8%, transparent);
}

.stage-loader span::after {
  position: absolute;
  inset: 0 60% 0 0;
  border-radius: inherit;
  background: color-mix(in srgb, var(--vp-c-text-1) 25%, transparent);
  animation: stage-loader-slide 1s ease-in-out infinite;
  content: '';
}

@keyframes stage-loader-slide {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(250%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .stage-loader span::after {
    animation: none;
  }
}
</style>
