<script setup lang="ts">
import AsyncError from './AsyncError.vue'
import LoadingState from './LoadingState.vue'

const { pending, error, loadingLabel, errorLabel, retryLabel } = defineProps<{
  pending: boolean
  error: boolean
  loadingLabel: string
  errorLabel: string
  retryLabel: string
}>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <LoadingState v-if="pending" :label="loadingLabel" />
  <AsyncError
    v-else-if="error"
    :title="errorLabel"
    :retry-label="retryLabel"
    @retry="emit('retry')"
  />
  <slot v-else />
</template>
