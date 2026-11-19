<script setup lang="ts">
import { computed } from 'vue'

/**
 * A translated sentence whose `{name}` placeholders become links, so the words linked sit where
 * each language puts them. A placeholder without a link stays as written.
 */
const { text, links, linkClass } = defineProps<{
  text: string
  links: Record<string, { href: string; label: string } | undefined>
  linkClass?: string
}>()

const parts = computed(() =>
  text.split(/(\{\w+\})/).map((part) => {
    const link = /^\{(\w+)\}$/.exec(part)?.[1]
    return { text: part, link: link ? links[link] : undefined }
  })
)
</script>

<template>
  <template v-for="(part, index) in parts" :key="index">
    <a
      v-if="part.link"
      :href="part.link.href"
      target="_blank"
      rel="noreferrer"
      :class="linkClass"
      >{{ part.link.label }}</a
    >
    <template v-else>{{ part.text }}</template>
  </template>
</template>
