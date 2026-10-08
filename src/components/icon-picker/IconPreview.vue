<script setup lang="ts">
import { computed } from 'vue'

/**
 * An icon drawn in the text color: its SVG markup serves as a mask, so it never runs as
 * markup in the page. Blank until the markup arrives, rather than a filled square.
 */
const { svg } = defineProps<{ svg?: string | null }>()
const style = computed(() =>
  svg ? { '--icon-preview': `url("data:image/svg+xml,${encodeURIComponent(svg)}")` } : undefined
)
</script>

<template>
  <span
    aria-hidden="true"
    class="inline-block size-4 shrink-0 mask-(--icon-preview) mask-contain mask-center mask-no-repeat data-[drawn]:bg-current"
    :data-drawn="svg ? '' : undefined"
    :style="style"
  />
</template>
