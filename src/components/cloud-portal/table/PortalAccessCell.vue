<script setup lang="ts">
import { computed } from 'vue'
import IconLucideGlobe from '~icons/lucide/globe'
import IconLucideLink from '~icons/lucide/link'
import IconLucideLock from '~icons/lucide/lock'
import IconLucidePencilLine from '~icons/lucide/pencil-line'

import { useMessages } from '@open-pencil/vue/i18n'

import type { DocumentAccess } from '../console/content'

/**
 * Who beyond its workspace can open a document, as an icon and a few plain words: a fact about it,
 * not a warning, so it draws no badge.
 */
const { access } = defineProps<{ access: DocumentAccess }>()
const messages = useMessages('cloud/portal')

const ICONS = {
  community: IconLucideGlobe,
  'edit-link': IconLucidePencilLine,
  link: IconLucideLink,
  private: IconLucideLock
} as const satisfies Record<DocumentAccess, unknown>
const label = computed(
  () =>
    ({
      community: messages.value.inCommunity,
      'edit-link': messages.value.editableByLink,
      link: messages.value.sharedByLink,
      private: messages.value.privateDocument
    })[access]
)
</script>

<template>
  <span class="flex min-w-0 items-center gap-1.5 text-surface/80">
    <component :is="ICONS[access]" class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
    <span class="truncate">{{ label }}</span>
  </span>
</template>
