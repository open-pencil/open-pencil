<script setup lang="ts">
/** An image the security rules refused has no address left, and shows nothing. */
const { src, alt } = defineProps<{ src?: string; alt?: string }>()
</script>

<template>
  <img v-if="src" :src="src" :alt="alt" />
</template>
