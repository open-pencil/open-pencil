<script setup lang="ts">
import { computed } from 'vue'

import type { CloudLegalDiscovery } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { portalPublic } from '@/components/cloud-portal/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalLinkedText from '../layout/PortalLinkedText.vue'
import { legalLinks, termsDescription } from './legal'
import PortalNotice from './PortalNotice.vue'

/**
 * A server's terms for an account to accept before it uses the server, with its privacy policy
 * beside them: accepting goes on, declining signs out.
 */
const {
  host,
  legal,
  accepting = false,
  error = null
} = defineProps<{
  host: string
  legal: CloudLegalDiscovery
  accepting?: boolean
  /** Why accepting failed, already worded for people. */
  error?: string | null
}>()

const emit = defineEmits<{ accept: []; decline: [] }>()

const ui = portalPublic()
const messages = useCloudPortalMessages()
const description = computed(() => termsDescription(messages.value, legal, host))
const links = computed(() => legalLinks(messages.value, legal))
</script>

<template>
  <PortalNotice :host="host" :heading="messages.termsTitle">
    <template #icon>
      <icon-lucide-scroll-text class="size-6" />
    </template>
    <template #description>
      <PortalLinkedText :text="description" :links="links" :link-class="ui.inlineLink()" />
    </template>
    <AppAlert v-if="error" tone="error" :heading="error" />
    <template #actions>
      <AppButton
        size="lg"
        color="primary"
        variant="solid"
        class="w-full"
        :loading="accepting"
        @click="emit('accept')"
      >
        {{ messages.acceptTerms }}
      </AppButton>
      <AppButton
        size="lg"
        variant="ghost"
        class="w-full"
        :disabled="accepting"
        @click="emit('decline')"
      >
        {{ messages.declineTerms }}
      </AppButton>
    </template>
  </PortalNotice>
</template>
