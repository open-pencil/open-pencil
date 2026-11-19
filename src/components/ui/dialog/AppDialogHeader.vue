<script setup lang="ts">
import { DialogClose, DialogDescription, DialogTitle } from 'reka-ui'
import { computed } from 'vue'

import { useCommonMessages } from '@open-pencil/vue/i18n'

import { useDialogUI, type DialogUI } from '@/components/ui/dialog/ui'

const {
  heading,
  description,
  closeLabel,
  showClose = true,
  titleVisuallyHidden = false,
  ui
} = defineProps<{
  heading: string
  description?: string
  closeLabel?: string
  showClose?: boolean
  titleVisuallyHidden?: boolean
  ui?: DialogUI
}>()

const cls = useDialogUI(ui)
const common = useCommonMessages()
/** Close, unless the dialog names its close button otherwise. */
const closeName = computed(() => closeLabel ?? common.value.close)
</script>

<template>
  <header data-slot="dialog-header" :class="cls.header">
    <div :class="cls.heading">
      <DialogTitle
        data-slot="dialog-title"
        :data-visually-hidden="titleVisuallyHidden"
        :class="cls.title"
      >
        <slot name="title">{{ heading }}</slot>
      </DialogTitle>
      <DialogDescription
        v-if="description || $slots.description"
        data-slot="dialog-description"
        :class="cls.description"
        class="mt-0.5"
      >
        <slot name="description">{{ description }}</slot>
      </DialogDescription>
    </div>
    <slot name="actions" />
    <DialogClose v-if="showClose" as-child>
      <button type="button" data-slot="dialog-close" :class="cls.close" :aria-label="closeName">
        <slot name="close-icon"><icon-lucide-x class="size-4" /></slot>
      </button>
    </DialogClose>
  </header>
</template>
