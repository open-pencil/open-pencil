<script setup lang="ts">
import { HoverCardContent, HoverCardPortal, HoverCardRoot, HoverCardTrigger } from 'reka-ui'
import { ref } from 'vue'

import type { ImageAttachmentPresentation } from '@/app/ai/attachment/image/types'
import { AppDialogBody, AppDialogHeader, AppDialogRoot } from '@/components/ui/dialog'

const { attachment } = defineProps<{ attachment: ImageAttachmentPresentation }>()
const viewerOpen = ref(false)
const viewLabel = `View image ${attachment.name}`
</script>

<template>
  <HoverCardRoot :open-delay="350" :close-delay="100">
    <HoverCardTrigger as-child>
      <button
        type="button"
        :aria-label="viewLabel"
        class="group block overflow-hidden rounded-lg border border-white/25 bg-black/15 text-left shadow-xs transition-colors hover:border-white/50 focus-visible:border-white/60 focus-visible:outline-2 focus-visible:outline-white"
        @click="viewerOpen = true"
      >
        <img
          :src="attachment.previewURL"
          :alt="attachment.name"
          class="h-20 w-28 border-b border-white/15 bg-black/10 object-contain"
        />
        <span
          class="block max-w-28 truncate px-1.5 py-1 text-[9px] leading-tight text-white/85 group-hover:text-white"
        >
          {{ attachment.name }}
        </span>
      </button>
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent
        side="left"
        :side-offset="8"
        :collision-padding="12"
        class="z-60 rounded-lg border border-border bg-panel p-2 shadow-xl"
      >
        <img
          :src="attachment.previewURL"
          :alt="attachment.name"
          class="max-h-80 max-w-120 object-contain"
        />
        <div class="mt-1.5 text-[10px] text-muted">
          {{ attachment.name }} · {{ attachment.originalWidth }} ×
          {{ attachment.originalHeight }}
        </div>
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>

  <AppDialogRoot v-model:open="viewerOpen" size="xl">
    <AppDialogHeader
      :heading="attachment.name"
      description="Image preview"
      close-label="Close image preview"
    />
    <AppDialogBody class="flex min-h-0 items-center justify-center bg-canvas p-4">
      <img
        :src="attachment.previewURL"
        :alt="attachment.name"
        class="max-h-[75vh] max-w-full object-contain"
      />
    </AppDialogBody>
    <div class="border-t border-border px-4 py-2 text-xs text-muted">
      {{ attachment.originalWidth }} × {{ attachment.originalHeight }} · Display preview
      {{ attachment.previewWidth }} × {{ attachment.previewHeight }}
    </div>
  </AppDialogRoot>
</template>
