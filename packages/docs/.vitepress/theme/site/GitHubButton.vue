<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'

import { LINKS } from '../landing/content/links'
import { SITE_MESSAGES } from './messages'
import { data } from './repository.data'

/**
 * The repository beside the editor's button, with its stars as GitHub counted them at build; the
 * header shows it from 1320px wide (`Layout.vue`).
 */
const { lang, localeIndex } = useData()
const messages = computed(
  () => SITE_MESSAGES[localeIndex.value as keyof typeof SITE_MESSAGES] ?? SITE_MESSAGES.root
)
const stars = computed(() =>
  data.stars === null
    ? null
    : new Intl.NumberFormat(lang.value, { notation: 'compact', maximumFractionDigits: 1 }).format(
        data.stars
      )
)
const label = computed(() =>
  stars.value === null ? 'GitHub' : messages.value.githubStars.replace('{stars}', stars.value)
)
</script>

<template>
  <a class="github" :href="LINKS.github" :aria-label="label">
    <icon-simple-icons-github class="mark" aria-hidden="true" />
    <span v-if="stars" class="stars">
      <icon-lucide-star class="star" aria-hidden="true" />
      {{ stars }}
    </span>
    <span v-else>GitHub</span>
  </a>
</template>

<style scoped>
.github {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  color: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  margin-left: 12px;
  transition:
    border-color 0.25s,
    background-color 0.25s;
}

.github:hover {
  border-color: var(--vp-c-gray-1);
  background-color: var(--vp-c-default-soft);
}

.mark {
  width: 18px;
  height: 18px;
}

.stars {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-variant-numeric: tabular-nums;
}

.star {
  width: 13px;
  height: 13px;
}
</style>
