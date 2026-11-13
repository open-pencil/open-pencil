<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCommonMessages } from '@open-pencil/vue/i18n'

import { PENDING_LINK_PROTOCOL } from '@/app/shell/markdown/config'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'

/**
 * A link in Markdown that a model or a person wrote. It shows its address and asks before
 * opening it, so a link's text cannot hide where it goes. A link whose address is still
 * streaming in shows nothing yet: it appears once complete, as a chat reference does, which a
 * partial address could not resolve.
 */
const { href } = defineProps<{ href?: string }>()

const common = useCommonMessages()
const confirming = ref(false)
const pending = computed(() => href?.startsWith(`${PENDING_LINK_PROTOCOL}:`) ?? false)

function open() {
  if (href) window.open(href, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <!-- A link the security rules refused keeps its text. -->
  <span v-if="!href"><slot /></span>
  <a
    v-else-if="!pending"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    data-markdown="link"
    @click.prevent="confirming = true"
    ><slot
  /></a>
  <AppConfirmationDialog
    v-if="href && !pending"
    v-model:open="confirming"
    :heading="common.openLinkHeading"
    :description="href"
    :confirm-label="common.openLink"
    @confirm="open"
  />
</template>
