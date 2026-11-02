<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { continuationPath, continuationURL } from '@/app/cloud-portal/navigation'
import PortalNotice from '@/components/cloud-portal/auth/PortalNotice.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

const portal = usePortal()
const route = useRoute()
const router = useRouter()
const messages = useCloudPortalMessages()
const { failure } = usePortalFailureMessages()
const email = computed(() => (typeof route.query.email === 'string' ? route.query.email : ''))
const redirect = computed(() => continuationPath(route.query.redirect))
const state = ref<'idle' | 'sending' | 'sent'>('idle')
const error = ref<string | null>(null)

async function sendAgain() {
  state.value = 'sending'
  error.value = null
  const result = await portal.auth.resendVerification(
    email.value,
    continuationURL('/auth/sign-in', redirect.value)
  )
  if (result.ok) {
    state.value = 'sent'
    return
  }
  // Nothing was sent, so the button stays available to try again.
  state.value = 'idle'
  error.value = failure(result.failure)
}
</script>

<template>
  <PortalNotice
    :host="portal.host"
    :heading="messages.checkEmailTitle"
    :description="messages.checkEmailDescription({ email })"
  >
    <template #icon><icon-lucide-mail-check class="size-6" /></template>
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <template #actions>
      <AppButton
        size="lg"
        color="primary"
        variant="solid"
        class="w-full"
        :loading="state === 'sending'"
        :disabled="state === 'sent' || !email"
        @click="sendAgain"
      >
        {{ state === 'sent' ? messages.sent : messages.sendAgain }}
      </AppButton>
      <AppButton
        size="lg"
        variant="outline"
        class="w-full"
        @click="router.replace({ name: 'sign-up', query: { redirect } })"
      >
        {{ messages.useAnotherEmail }}
      </AppButton>
    </template>
  </PortalNotice>
</template>
