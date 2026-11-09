<script setup lang="ts">
import type { GitBranch } from '@/app/integrations/git/schema'
import AppButton from '@/components/ui/button/AppButton.vue'

/**
 * The branches of a repository as chips: the one checked out reads as chosen, the others switch
 * to it. A project's panel and a document's panel both show branches this way.
 */
const { branches, disabled = false } = defineProps<{
  branches: GitBranch[]
  disabled?: boolean
}>()

const emit = defineEmits<{ checkout: [name: string] }>()
</script>

<template>
  <div v-if="branches.length > 1" class="flex flex-wrap gap-1">
    <AppButton
      v-for="item in branches"
      :key="item.name"
      size="xs"
      :variant="item.current ? 'soft' : 'ghost'"
      :disabled="disabled || item.current"
      @click="emit('checkout', item.name)"
    >
      {{ item.name }}
    </AppButton>
  </div>
</template>
