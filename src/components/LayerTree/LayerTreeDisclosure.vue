<script setup lang="ts">
const { expanded, visible, label, ui } = defineProps<{
  expanded: boolean
  visible: boolean
  label: string
  ui: { disclosure: string; placeholder: string }
}>()
const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    v-if="visible"
    type="button"
    tabindex="-1"
    data-slot="disclosure"
    :aria-label="label"
    :aria-expanded="expanded"
    :data-expanded="expanded || undefined"
    :class="ui.disclosure"
    @click.stop="emit('toggle')"
  >
    <icon-lucide-chevron-right class="size-3" />
  </button>
  <span v-else data-slot="disclosure-placeholder" :class="ui.placeholder" />
</template>
