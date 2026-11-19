<script setup lang="ts">
import { tabs } from './ui'

/**
 * Names the group of tabs below it. It is for the eye only: a tab list holds tabs, so screen
 * readers hear each tab's own name and move through them as one list.
 */
const styles = tabs()
</script>

<template>
  <div :class="styles.heading()" aria-hidden="true" data-slot="tabs-heading"><slot /></div>
</template>
