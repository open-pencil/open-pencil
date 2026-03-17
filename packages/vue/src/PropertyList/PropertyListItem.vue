<script setup lang="ts">
import { usePropertyList } from './context'

const { index } = defineProps<{
  index: number
}>()

const { update, patch, remove, toggleVisibility } = usePropertyList()
</script>

<template>
  <slot
    :index="index"
    :update="(item: unknown) => update(index, item)"
    :patch="(changes: Record<string, unknown>) => patch(index, changes)"
    :remove="() => remove(index)"
    :toggle-visibility="() => toggleVisibility(index)"
  />
</template>
