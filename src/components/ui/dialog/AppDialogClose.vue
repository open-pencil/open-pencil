<script setup lang="ts">
import { DialogClose } from 'reka-ui'

import { useDialogUI } from '@/components/ui/dialog/ui'

const { ariaLabel, class: className } = defineProps<{
  ariaLabel: string
  class?: string
}>()

const cls = useDialogUI({ close: className })
</script>

<template>
  <DialogClose as-child>
    <button type="button" data-slot="dialog-close" :class="cls.close" :aria-label="ariaLabel">
      <slot><icon-lucide-x class="size-4" /></slot>
    </button>
  </DialogClose>
</template>
