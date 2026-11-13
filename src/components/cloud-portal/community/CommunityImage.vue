<script setup lang="ts">
import { ref } from 'vue'

/** A file's preview, which fades in once it has loaded rather than drawing in as it arrives. */
const { src, alt } = defineProps<{ src: string; alt: string; eager?: boolean }>()
const loaded = ref(false)
</script>

<template>
  <img
    :src="src"
    :alt="alt"
    :loading="eager ? 'eager' : 'lazy'"
    decoding="async"
    :data-loaded="loaded || undefined"
    @load="loaded = true"
  />
</template>
