<script setup lang="ts">
import { ConfigProvider, Primitive } from 'reka-ui'
</script>

<!--
  Keeps its one child left to right in a mirrored interface: the child gets `dir="ltr"` and Reka
  components inside read the same direction. For what describes the canvas, not reading order:
  the canvas and rulers, coordinates and other numbers, colors and gradients, alignment, and code.
-->
<template>
  <ConfigProvider dir="ltr">
    <Primitive as-child dir="ltr">
      <slot />
    </Primitive>
  </ConfigProvider>
</template>
