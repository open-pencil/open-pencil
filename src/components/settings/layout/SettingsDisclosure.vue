<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'

import { settingsDisclosureMotion } from '@/theme/settings/disclosure'

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <CollapsibleRoot v-model:open="open">
    <div class="flex items-center gap-3">
      <CollapsibleTrigger
        class="group flex min-w-0 flex-1 items-center gap-2 py-3 text-left text-xs text-surface"
      >
        <icon-lucide-chevron-right
          class="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none"
        />
        <slot name="label" />
      </CollapsibleTrigger>
      <slot name="actions" />
    </div>
    <CollapsibleContent :class="settingsDisclosureMotion">
      <div class="pb-3"><slot /></div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
