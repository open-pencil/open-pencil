<script setup lang="ts">
import { withBase } from 'vitepress'
import { computed } from 'vue'

import { useKeyPlatform } from './keys'
import sizes from './sizes.json'

/**
 * A picture from `public/guide` in the reader's color scheme, centered on a backdrop as wide as
 * the text (`tools/generate/guide-images`). `other` names the one for Windows and Linux keys.
 */
const {
  name,
  alt,
  caption = '',
  other
} = defineProps<{
  name: keyof typeof sizes
  alt: string
  /** Shown above the picture. */
  caption?: string
  other?: keyof typeof sizes
}>()

const THEMES = ['light', 'dark'] as const
const platform = useKeyPlatform()
const shown = computed(() => (platform.value === 'other' && other) || name)
</script>

<template>
  <figure class="guide-image">
    <figcaption v-if="caption">{{ caption }}</figcaption>
    <img
      v-for="theme in THEMES"
      :key="theme"
      :class="theme"
      :src="withBase(`/guide/${shown}/${theme}.webp`)"
      :alt="alt"
      :width="sizes[shown].width"
      :height="sizes[shown].height"
      loading="lazy"
    />
  </figure>
</template>

<style scoped>
.guide-image {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 20px 0 24px;
  padding: 24px 8px 20px;
  border-radius: 12px;
  background: #dde3ec;
}

.guide-image img {
  max-width: 100%;
  height: auto;
}

figcaption {
  margin-bottom: 8px;
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 500;
  text-align: center;
}

.guide-image .dark,
.dark .guide-image .light {
  display: none;
}

.dark .guide-image {
  background: #3a404c;
}

.dark .guide-image .dark {
  display: block;
}
</style>
