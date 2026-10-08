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
  waiting = false
} = defineProps<{
  kind: FeatureKind
  fingerprint: string
  locale: string
  /** The stage starts only when asked, as on a phone; the poster offers to start it. */
  waiting?: boolean
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
  </div>
</template>

<style scoped>
.stage-poster {
  position: absolute;
  z-index: 1;
  inset: 0;
  background: var(--vp-c-bg);
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
