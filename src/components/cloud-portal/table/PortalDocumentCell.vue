<script setup lang="ts">
import { HoverCardContent, HoverCardPortal, HoverCardRoot, HoverCardTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, ref, watch } from 'vue'

import type { DocumentKind } from '@open-pencil/scene-graph'
import { useCloudPortalMessages, useI18n } from '@open-pencil/vue/i18n'

import { DOCUMENT_KIND_ICONS } from '@/components/document/kinds'
import { useInlineSide } from '@/components/ui/direction/inline-side'
import AppBadge from '@/components/ui/feedback/AppBadge.vue'
import documentCellTheme from '@/theme/cloud-portal/document-cell'

import { portalTable } from './ui'

/**
 * A document in a console table: a miniature of its saved thumbnail, whose larger preview shows on
 * hover, beside its kind's icon, name, and workspace. A document never saved, or whose thumbnail
 * fails to load, shows its kind's icon in place of the miniature.
 */
const {
  name,
  kind,
  workspace,
  thumbnail = null,
  badge = null
} = defineProps<{
  name: string
  kind: DocumentKind
  workspace: string
  thumbnail?: string | null
  badge?: string | null
}>()

const messages = useCloudPortalMessages()
const { files } = useI18n()
const endSide = useInlineSide('end')
const table = portalTable()
const documentCell = tv(documentCellTheme)
const ui = computed(() => documentCell({ kind }))
const kindLabel = computed(
  () => ({ design: files.value.createDesign, board: files.value.createBoard })[kind]
)
const failed = ref(false)
watch(
  () => thumbnail,
  () => {
    failed.value = false
  }
)
</script>

<template>
  <div :class="ui.root()">
    <HoverCardRoot v-if="thumbnail && !failed" :open-delay="300" :close-delay="100">
      <!-- A button, so the keyboard can open the preview as hovering does. -->
      <HoverCardTrigger as-child>
        <button
          type="button"
          data-test-id="document-miniature"
          :aria-label="messages.documentPreview({ name })"
          :class="ui.trigger()"
        >
          <img :src="thumbnail" alt="" loading="lazy" :class="ui.image()" @error="failed = true" />
        </button>
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent
          data-test-id="document-preview"
          :class="ui.card()"
          :side="endSide"
          align="start"
          :side-offset="8"
        >
          <img :src="thumbnail" :alt="messages.documentPreview({ name })" :class="ui.preview()" />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCardRoot>
    <span v-else :class="ui.miniature()">
      <component :is="DOCUMENT_KIND_ICONS[kind]" :class="ui.fallback()" aria-hidden="true" />
    </span>
    <div :class="ui.body()">
      <p :class="table.title()">
        <component :is="DOCUMENT_KIND_ICONS[kind]" :class="ui.kind()" aria-hidden="true" />
        <span class="sr-only">{{ kindLabel }},</span>
        <span :class="ui.name()">{{ name }}</span>
        <AppBadge v-if="badge">{{ badge }}</AppBadge>
      </p>
      <p :class="table.detail()">{{ workspace }}</p>
    </div>
  </div>
</template>
