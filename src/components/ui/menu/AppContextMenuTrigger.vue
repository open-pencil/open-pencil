<script setup lang="ts">
import { ContextMenuTrigger } from 'reka-ui'

// Reka's context menu trigger forces `pointer-events: auto`, so it takes presses even while an
// open select, menu, or dialog has turned them off for the page. A press meant only to close that
// layer then acted on the trigger: on the canvas behind a picker it cleared the selection and
// closed the picker. Unsetting the value leaves the element's own, such as a comment pin's
// `pointer-events-auto`, or the page's. Its props and listeners, such as `as-child`, fall through.
</script>

<template>
  <ContextMenuTrigger :style="{ pointerEvents: undefined }">
    <slot />
  </ContextMenuTrigger>
</template>
