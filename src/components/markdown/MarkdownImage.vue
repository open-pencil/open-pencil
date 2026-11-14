<script setup lang="ts">
import { computed } from 'vue'

import { isAllowedImageSource, MARKDOWN_ORIGIN } from '@/app/shell/markdown/config'

/**
 * An image in Markdown, shown only from the app's own origin: one the security rules refused has
 * no address left, and one bound from another attribute is checked here, after Comark resolves it.
 */
const { src, alt } = defineProps<{ src?: string; alt?: string }>()

const allowed = computed(() => !!src && isAllowedImageSource(src, MARKDOWN_ORIGIN))
</script>

<template>
  <img v-if="allowed" :src="src" :alt="alt" />
</template>
