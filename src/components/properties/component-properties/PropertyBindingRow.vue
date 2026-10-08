<script setup lang="ts">
import type { ComponentBinding } from '@open-pencil/vue'
import { usePanelMessages } from '@open-pencil/vue'

import { sceneNodeIcon } from '@/app/editor/icons'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

const { binding, disabled } = defineProps<{ binding: ComponentBinding; disabled?: boolean }>()
defineEmits<{ select: [id: string]; unbind: [binding: ComponentBinding] }>()
const panels = usePanelMessages()
</script>

<template>
  <div class="flex items-center gap-1" :data-node-id="binding.nodeId">
    <AppButton
      size="xs"
      variant="ghost"
      class="min-w-0 flex-1 justify-start"
      :aria-label="binding.variantName ? `${binding.variantName}: ${binding.name}` : binding.name"
      @click="$emit('select', binding.nodeId)"
    >
      <component :is="sceneNodeIcon(binding.node)" class="size-3.5 shrink-0" aria-hidden="true" />
      <span class="min-w-0 truncate text-left"
        >{{ binding.variantName ? `${binding.variantName} / ` : '' }}{{ binding.name }}</span
      >
    </AppButton>
    <IconButton
      :label="`${panels.detachComponentProperty}: ${binding.variantName ? `${binding.variantName}: ` : ''}${binding.name}`"
      :disabled="disabled"
      @click="$emit('unbind', binding)"
    >
      <icon-lucide-unlink class="size-3.5" />
    </IconButton>
  </div>
</template>
