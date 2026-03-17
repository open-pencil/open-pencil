<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '../context'
import { useSceneComputed } from '../composables/use-scene-reactive'

const editor = useEditor()

const collectionCount = useSceneComputed(() => editor.getCollectionCount())
const variableCount = useSceneComputed(() => editor.getVariableCount())
const hasVariables = computed(() => variableCount.value > 0)
</script>

<template>
  <slot
    :collection-count="collectionCount"
    :variable-count="variableCount"
    :has-variables="hasVariables"
  />
</template>
