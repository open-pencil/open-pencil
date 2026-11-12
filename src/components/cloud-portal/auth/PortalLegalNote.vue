<script setup lang="ts">
import { computed } from 'vue'

import type { CloudLegalDiscovery } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { portalPublic } from '@/components/cloud-portal/ui'

import PortalLinkedText from '../layout/PortalLinkedText.vue'
import { legalLinks, legalSentence } from './legal'

/**
 * What signing in or up agrees to on this server, in one short paragraph: its terms and privacy
 * policy, linked where the sentence names them, and the age it asks for. A server that names none
 * shows nothing.
 */
const { legal } = defineProps<{ legal?: CloudLegalDiscovery }>()

const ui = portalPublic()
const messages = useCloudPortalMessages()
const consent = computed(() => (legal ? legalSentence(messages.value, legal) : null))
const age = computed(() =>
  legal?.minimumAge ? messages.value.minimumAge({ age: String(legal.minimumAge) }) : null
)
const links = computed(() => legalLinks(messages.value, legal))
</script>

<template>
  <p v-if="consent || age" :class="ui.note()">
    <PortalLinkedText v-if="consent" :text="consent" :links="links" :link-class="ui.inlineLink()" />
    {{ age }}
  </p>
</template>
