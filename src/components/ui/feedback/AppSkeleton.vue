<script setup lang="ts">
import { skeleton } from './skeleton'

/**
 * One grey bar where text or a control will be once it loads; give it the width of what it stands
 * for. Placeholders are for the eye only, so assistive technology skips them.
 */
const { class: className } = defineProps<{ class?: string }>()
const styles = skeleton()
</script>

<template>
  <span :class="styles.bar({ class: className })" aria-hidden="true" />
</template>
