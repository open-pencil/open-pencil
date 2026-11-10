<script setup lang="ts">
import type { CloudLegalDiscovery } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { portalPublic } from '@/components/cloud-portal/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

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
</script>

<template>
  <PortalNotice
    :host="host"
    :heading="messages.termsTitle"
    :description="messages.termsDescription({ host })"
  >
    <template #icon>
      <icon-lucide-scroll-text class="size-6" />
    </template>
    <div :class="ui.documents()">
      <a
        v-if="legal.termsURL"
        :href="legal.termsURL"
        target="_blank"
        rel="noreferrer"
        :class="ui.document()"
      >
        {{ messages.termsOfService }}
      </a>
      <a
        v-if="legal.privacyURL"
        :href="legal.privacyURL"
        target="_blank"
        rel="noreferrer"
        :class="ui.document()"
      >
        {{ messages.privacyPolicy }}
      </a>
    </div>
    <AppAlert v-if="error" tone="error" :heading="messages.termsTitle" :description="error" />
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
