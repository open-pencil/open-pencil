<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '../context'

import type { Color } from '@open-pencil/core'

const editor = useEditor()

const pageColor = computed(() => editor.state.pageColor)

function setPageColor(color: Color) {
  editor.setPageColor(color)
}
</script>

<template>
  <slot :page-color="pageColor" :set-page-color="setPageColor" />
</template>
