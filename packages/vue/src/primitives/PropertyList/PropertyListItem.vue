<script setup lang="ts">
import { usePropertyList } from '#vue/primitives/PropertyList/context'

const { index } = defineProps<{
  index: number
}>()

const emit = defineEmits<{
  update: [index: number, item: unknown]
  patch: [index: number, changes: Record<string, unknown>]
  remove: [index: number]
  toggleVisibility: [index: number]
}>()

const { update, patch, remove, toggleVisibility } = usePropertyList()

const actions = {
  update: (item: unknown) => {
    emit('update', index, item)
    update(index, item)
  },
  patch: (changes: Record<string, unknown>) => {
    emit('patch', index, changes)
    patch(index, changes)
  },
  remove: () => {
    emit('remove', index)
    remove(index)
  },
  toggleVisibility: () => {
    emit('toggleVisibility', index)
    toggleVisibility(index)
  }
}
</script>

<template>
  <slot :index="index" :actions="actions" />
</template>
