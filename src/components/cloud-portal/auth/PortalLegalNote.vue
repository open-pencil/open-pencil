<script setup lang="ts">
import { computed } from 'vue'

import type { CloudLegalDiscovery } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { portalPublic } from '@/components/cloud-portal/ui'

/**
 * What signing in or up agrees to on this server: its terms and privacy policy, linked, and the
 * age it asks for. A server that names none shows nothing.
 */
const { legal } = defineProps<{ legal?: CloudLegalDiscovery }>()

const ui = portalPublic()
const messages = useCloudPortalMessages()
const consent = computed(() => {
  if (!legal) return null
  if (legal.termsURL && legal.privacyURL) return messages.value.consentTermsAndPrivacy
  if (legal.termsURL) return messages.value.consentTerms
  if (legal.privacyURL) return messages.value.consentPrivacy
  return null
})
</script>

<template>
  <div v-if="consent || legal?.minimumAge" :class="ui.note()">
    <p v-if="consent">{{ consent }}</p>
    <p v-if="legal?.minimumAge">{{ messages.minimumAge({ age: String(legal.minimumAge) }) }}</p>
    <span v-if="legal?.termsURL || legal?.privacyURL" :class="ui.noteLinks()">
      <a
        v-if="legal.termsURL"
        :href="legal.termsURL"
        target="_blank"
        rel="noreferrer"
        :class="ui.noteLink()"
      >
        {{ messages.termsOfService }}
      </a>
      <a
        v-if="legal.privacyURL"
        :href="legal.privacyURL"
        target="_blank"
        rel="noreferrer"
        :class="ui.noteLink()"
      >
        {{ messages.privacyPolicy }}
      </a>
    </span>
  </div>
</template>
