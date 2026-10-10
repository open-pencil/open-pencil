<script setup lang="ts">
import { withBase } from 'vitepress'
import IconPlay from '~icons/lucide/play'

import type { FeatureKind } from '../content/features'
import { useLandingMessages } from '../content/messages'
import {
  PHONE_MAX_WIDTH,
  POSTER_THEMES,
  posterParts,
  posterPath,
  type PosterPart,
  type PosterTheme
} from '../posters'

/**
 * A still of the stage until the live one is ready, laid out as the stage lays out its canvas
 * and panel. Both themes are rendered and CSS shows the current one; a hidden lazy image is
 * never fetched, so a visitor downloads one theme at the layout their screen uses.
 */
const {
  kind,
  fingerprint,
  locale,
  waiting = false,
  loading = false
} = defineProps<{
  kind: FeatureKind
  fingerprint: string
  locale: string
  /** The stage starts only when asked, as on a phone; the poster offers to start it. */
  waiting?: boolean
  /** The live stage is on its way; a slow one shows a quiet progress line. */
  loading?: boolean
}>()
const emit = defineEmits<{ activate: [] }>()

const messages = useLandingMessages()
const phoneMedia = `(max-width: ${PHONE_MAX_WIDTH}px)`

function source(theme: PosterTheme, layout: 'desktop' | 'phone', part: PosterPart): string {
  return withBase(`/${posterPath({ fingerprint, locale, theme, layout }, kind, part)}`)
}
</script>

<template>
  <div class="stage-poster" :data-kind="kind">
    <div v-for="theme in POSTER_THEMES" :key="theme" class="layer" :data-theme="theme">
      <picture v-for="part in posterParts(kind)" :key="part" :class="part">
        <source :media="phoneMedia" :srcset="source(theme, 'phone', part)" />
        <img :src="source(theme, 'desktop', part)" alt="" loading="lazy" decoding="async" />
      </picture>
    </div>
    <button v-if="waiting" type="button" class="activate" @click="emit('activate')">
      <IconPlay aria-hidden="true" />{{ messages.stage.activate }}
    </button>
    <span v-else-if="loading" class="progress" role="status" :aria-label="messages.loading" />
  </div>
</template>

<style scoped>
.stage-poster {
  position: absolute;
  /* Above the app's loading overlay (z-50), which the still stands in for. */
  z-index: 60;
  inset: 0;
  background: var(--vp-c-bg);
}

/*
 * Most stages are ready within a second; only a slow one shows that it is coming, with the
 * app loader's bar along the still's bottom edge.
 */
.progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  overflow: hidden;
  opacity: 0;
  animation: poster-progress-in 200ms ease-out 1s forwards;
}

.progress::after {
  position: absolute;
  inset: 0 70% 0 0;
  background: var(--vp-c-brand-1);
  animation: poster-progress-slide 1.2s ease-in-out infinite;
  content: '';
}

@keyframes poster-progress-in {
  to {
    opacity: 1;
  }
}

@keyframes poster-progress-slide {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(340%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress::after {
    inset: 0;
    animation: none;
    opacity: 0.4;
  }
}

.layer {
  display: flex;
  height: 100%;
}

/* Vue keeps only what is inside `:global()`, so the whole selector goes there. */
:global(html.dark .stage-poster > [data-theme='light']),
:global(html:not(.dark) .stage-poster > [data-theme='dark']) {
  display: none;
}

picture {
  display: block;
  min-width: 0;
  min-height: 0;
}

img {
  display: block;
  width: 100%;
  height: 100%;
}

/* The live canvas fits its scene to whatever room it has; the still does the same. */
.canvas,
.frame {
  flex: 1;
}

.canvas img,
.frame img {
  object-fit: contain;
}

/* The panel keeps its width, so its still is shown as captured, from the top left. */
.panel {
  flex: none;
  width: 18rem;
}

.panel img {
  object-fit: cover;
  object-position: left top;
}

.activate {
  position: absolute;
  bottom: 16px;
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 16px 0 12px;
  border: 1px solid var(--vp-button-brand-border);
  border-radius: 18px;
  background: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  transform: translateX(-50%);
}

.activate svg {
  width: 16px;
  height: 16px;
}

@media (max-width: 767px) {
  .layer {
    flex-direction: column;
  }

  .panel {
    width: auto;
    height: 16rem;
  }
}
</style>
