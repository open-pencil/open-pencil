<script setup lang="ts">
import { defineClientComponent, useData, withBase } from 'vitepress'
import { computed, onMounted, ref } from 'vue'

import type { FeatureKind } from '../content/features'
import { useLandingMessages } from '../content/messages'
import { isPosterCapture } from '../posters'
import StagePoster from './StagePoster.vue'

/** The editor needs WebGL and CanvasKit, so a stage never renders on the server. */
const FeatureStage = defineClientComponent(() => import('../stage/FeatureStage.vue'))
const CollabStage = defineClientComponent(() => import('../stage/collab/CollabStage.vue'))

const { kind } = defineProps<{ kind: FeatureKind }>()

const messages = useLandingMessages()
const { frontmatter, localeIndex } = useData()

/** Set by the production build when it captured stills of the stages; absent in development. */
const fingerprint = computed((): string | null => {
  const posters: unknown = frontmatter.value.posters
  return typeof posters === 'string' ? posters : null
})

// With stills on the page, the editor waits: on a desktop until the page has loaded, and on a
// touch screen, where a stage is only watched, until the visitor asks for it. Without stills,
// or while the generator captures them, stages start as soon as they can.
const live = ref(fingerprint.value === null)
const ready = ref(false)
// Decided after hydration, so the server-rendered poster and the client's first render agree.
const waiting = ref(false)

function start(): void {
  waiting.value = false
  live.value = true
}

onMounted(() => {
  if (live.value) return
  if (isPosterCapture()) start()
  else if (window.matchMedia('(pointer: coarse)').matches) waiting.value = true
  else if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
})
</script>

<template>
  <div class="stage-frame" :data-kind="kind" :data-ready="ready || undefined">
    <!-- Shown until the editor code arrives. It mirrors the app's canvas loading overlay,
         which takes over once the stage mounts on top of it. -->
    <div v-if="!fingerprint" class="stage-loader" role="status" :aria-label="messages.loading">
      <img :src="withBase('/brand/app-icon.svg')" alt="" />
      <span />
    </div>
    <template v-if="live">
      <CollabStage v-if="kind === 'collab'" @ready="ready = true" />
      <FeatureStage v-else :kind="kind" @ready="ready = true" />
    </template>
    <StagePoster
      v-if="fingerprint && !ready"
      :kind="kind"
      :fingerprint="fingerprint"
      :locale="localeIndex"
      :waiting="waiting"
      @activate="start"
    />
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
