<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { settingsTheme } from '@open-pencil/theme'

const ui = tv(settingsTheme)()
</script>

<template>
  <div :class="ui.group()">
    <slot />
  </div>
</template>
