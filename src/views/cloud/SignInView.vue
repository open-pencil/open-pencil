<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { CloudSocialProvider } from '@open-pencil/cloud/client'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { continuationPath, continuationURL, portalURL } from '@/app/cloud-portal/navigation'
import PortalSignIn from '@/components/cloud-portal/auth/PortalSignIn.vue'

const portal = usePortal()
const route = useRoute()
const router = useRouter()
const { failure, callback } = usePortalFailureMessages()

const mode = computed(() => (route.name === 'sign-up' ? 'sign-up' : 'sign-in'))
const redirect = computed(() => continuationPath(route.query.redirect))
const authentication = computed(() => portal.discovery.authentication)
const emailPassword = computed(() => {
  const credentials = authentication.value.emailPassword
  if (!credentials?.signIn) return null
  return { signUp: credentials.signUp, minimumPasswordLength: credentials.minimumPasswordLength }
})
const returnsTo = computed(() => {
  if (redirect.value.startsWith('/cloud/device')) return 'desktop'
  if (redirect.value.startsWith('/auth/return')) return 'editor'
  return null
})
const error = ref<string | null>(callback(route.query))
const submitting = ref(false)

async function withProvider(provider: CloudSocialProvider) {
  submitting.value = true
  const result = await portal.auth.withProvider(provider, portalURL(redirect.value))
  if (!result.ok) {
    error.value = failure(result.failure)
    submitting.value = false
  }
}

async function submit(input: { name: string; email: string; password: string }) {
  submitting.value = true
  error.value = null
  try {
    if (mode.value === 'sign-up') {
      const result = await portal.auth.signUp({
        ...input,
        verifiedURL: continuationURL('/auth/sign-in', redirect.value)
      })
      if (!result.ok) {
        error.value = failure(result.failure)
        return
      }
      await router.push({
        name: 'check-email',
        query: { email: input.email, redirect: redirect.value }
      })
      return
    }
    const result = await portal.auth.withEmail({ email: input.email, password: input.password })
    if (!result.ok) {
      error.value = failure(result.failure)
      return
    }
    if (result.value === 'two-step') {
      await router.push({ name: 'two-factor', query: { redirect: redirect.value } })
      return
    }
    await portal.refreshAccount()
    await router.replace(redirect.value)
  } finally {
    submitting.value = false
  }
}

// The editor's sign-in sends a provider along when the person already chose one there.
onMounted(() => {
  const provider = authentication.value.socialProviders.find(
    (candidate) => candidate === route.query.provider
  )
  if (provider && !error.value && mode.value === 'sign-in') void withProvider(provider)
})

function switchMode() {
  error.value = null
  void router.replace({
    name: mode.value === 'sign-up' ? 'sign-in' : 'sign-up',
    query: { redirect: redirect.value }
  })
}
</script>

<template>
  <PortalSignIn
    :host="portal.host"
    :mode="mode"
    :providers="authentication.socialProviders"
    :email-password="emailPassword"
    :approval-required="authentication.enrollmentMode === 'approval'"
    :error="error"
    :submitting="submitting"
    :returns-to="returnsTo"
    @provider="withProvider"
    @submit="submit"
    @forgot-password="router.push({ name: 'forgot-password', query: { redirect } })"
    @switch-mode="switchMode"
  />
</template>
