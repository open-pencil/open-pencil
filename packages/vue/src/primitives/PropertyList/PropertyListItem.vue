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
</script>

<template>
  <slot
    :index="index"
    :update="
      (item: unknown) => {
        emit('update', index, item)
        update(index, item)
      }
    "
    :patch="
      (changes: Record<string, unknown>) => {
        emit('patch', index, changes)
        patch(index, changes)
      }
    "
    :remove="
      () => {
        emit('remove', index)
        remove(index)
      }
    "
    :toggle-visibility="
      () => {
        emit('toggleVisibility', index)
        toggleVisibility(index)
      }
    "
  />
</template>
