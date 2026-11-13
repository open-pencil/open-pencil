<script setup lang="ts">
import { ref } from 'vue'

import { useCommonMessages } from '@open-pencil/vue/i18n'

import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'

/**
 * A link in Markdown that a model or a person wrote. It shows its address and asks before
 * opening it, so a link's text cannot hide where it goes.
 */
const { href } = defineProps<{ href?: string }>()

const common = useCommonMessages()
const confirming = ref(false)

function open() {
  if (href) window.open(href, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <!-- A link whose address the security rules refused keeps its text. -->
  <span v-if="!href"><slot /></span>
  <template v-else>
    <a
      :href="href"
      target="_blank"
      rel="noopener noreferrer"
      data-markdown="link"
      @click.prevent="confirming = true"
      ><slot
    /></a>
    <AppConfirmationDialog
      v-model:open="confirming"
      :heading="common.openLinkHeading"
      :description="href"
      :confirm-label="common.openLink"
      @confirm="open"
    />
  </template>
</template>
