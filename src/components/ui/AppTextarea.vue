<script setup lang="ts">
const model = defineModel<string>({ default: '' })

const { rows = 3, disabled = false } = defineProps<{ rows?: number; disabled?: boolean }>()
</script>

<template>
  <textarea
    v-model="model"
    :rows="rows"
    :disabled="disabled"
    class="w-full resize-none rounded border border-border bg-surface px-2 py-1.5 text-xs text-surface outline-none placeholder:text-muted focus:border-accent disabled:opacity-50"
  />
</template>
