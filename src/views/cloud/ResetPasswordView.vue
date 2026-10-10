<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCloudPortalMessages } from '@open-pencil/vue'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { continuationPath, continuationURL } from '@/app/cloud-portal/navigation'
import PortalNotice from '@/components/cloud-portal/auth/PortalNotice.vue'
import PortalResetPassword from '@/components/cloud-portal/auth/PortalResetPassword.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

const portal = usePortal()
const route = useRoute()
const router = useRouter()
const messages = useCloudPortalMessages()
const { failure } = usePortalFailureMessages()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : null))
const redirect = computed(() => continuationPath(route.query.redirect))
const minimum = computed(
  () => portal.discovery.authentication.emailPassword?.minimumPasswordLength ?? 15
)
const submitting = ref(false)
const error = ref<string | null>(
  typeof route.query.error === 'string' ? messages.value.failureInvalidLink : null
)
const sentTo = ref<string | null>(null)

async function request(email: string) {
  submitting.value = true
  error.value = null
  const result = await portal.auth.requestPasswordReset(
    email,
    continuationURL('/auth/reset-password', redirect.value)
  )
  submitting.value = false
  if (result.ok) sentTo.value = email
  else error.value = failure(result.failure)
}

async function choose(password: string) {
  if (!token.value) return
  submitting.value = true
  error.value = null
  const result = await portal.auth.resetPassword(token.value, password)
  submitting.value = false
  if (!result.ok) {
    error.value = failure(result.failure)
    return
  }
  await router.replace({ name: 'sign-in', query: { redirect: redirect.value } })
}
</script>

<template>
  <PortalNotice
    v-if="sentTo"
    :host="portal.host"
    :heading="messages.resetSentTitle"
    :description="messages.resetSentDescription({ email: sentTo })"
  >
    <template #icon><icon-lucide-mail-check class="size-5" /></template>
    <template #actions>
      <AppButton variant="ghost" @click="router.replace({ name: 'sign-in', query: { redirect } })">
        {{ messages.backToSignIn }}
      </AppButton>
    </template>
  </PortalNotice>
  <PortalResetPassword
    v-else
    :host="portal.host"
    :step="token ? 'choose' : 'request'"
    :minimum-password-length="minimum"
    :submitting="submitting"
    :error="error"
    @request="request"
    @choose="choose"
    @back="router.replace({ name: 'sign-in', query: { redirect } })"
  />
</template>
