<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCloudPortalMessages } from '@open-pencil/vue'

import { usePortal } from '@/app/cloud-portal/context'
import { continuationPath, continuationURL } from '@/app/cloud-portal/navigation'
import PortalNotice from '@/components/cloud-portal/auth/PortalNotice.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

const portal = usePortal()
const route = useRoute()
const router = useRouter()
const messages = useCloudPortalMessages()
const email = computed(() => (typeof route.query.email === 'string' ? route.query.email : ''))
const redirect = computed(() => continuationPath(route.query.redirect))
const state = ref<'idle' | 'sending' | 'sent'>('idle')

async function sendAgain() {
  state.value = 'sending'
  await portal.auth.resendVerification(
    email.value,
    continuationURL('/auth/sign-in', redirect.value)
  )
  state.value = 'sent'
}
</script>

<template>
  <PortalNotice
    :host="portal.host"
    :heading="messages.checkEmailTitle"
    :description="messages.checkEmailDescription({ email })"
  >
    <template #icon><icon-lucide-mail-check class="size-5" /></template>
    <template #actions>
      <AppButton
        variant="outline"
        :loading="state === 'sending'"
        :disabled="state === 'sent' || !email"
        @click="sendAgain"
      >
        {{ state === 'sent' ? messages.sent : messages.sendAgain }}
      </AppButton>
      <AppButton variant="ghost" @click="router.replace({ name: 'sign-up', query: { redirect } })">
        {{ messages.useAnotherEmail }}
      </AppButton>
    </template>
  </PortalNotice>
</template>
