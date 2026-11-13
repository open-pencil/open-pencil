<script setup lang="ts">
import { Text } from '@vue-email/components'

import { styles } from './brand'
</script>

<template>
  <Text :style="styles.text"><slot /></Text>
</template>
