<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { continuationPath } from '@/app/cloud-portal/navigation'
import { usePortalAction } from '@/app/cloud-portal/state'
import PortalTerms from '@/components/cloud-portal/auth/PortalTerms.vue'

/**
 * The server's terms, which an account accepts before it uses the server when the server asks it
 * to, and again whenever their version changes. Declining signs out.
 */
const portal = usePortal()
const route = useRoute()
const router = useRouter()
const { failure } = usePortalFailureMessages()
const legal = computed(() => portal.discovery.legal)

// Accepting names the version this page loaded; terms replaced since then answer `terms_changed`,
// which asks for a reload to read the new ones.
const {
  busy: accepting,
  error: acceptFailure,
  run: accept
} = usePortalAction(async () => {
  const version = legal.value?.termsVersion
  if (!version) return
  await portal.api.acceptTerms(version)
  await portal.refreshAccount()
  await router.replace(continuationPath(route.query.redirect))
})

const {
  busy: declining,
  error: declineFailure,
  run: decline,
  fail
} = usePortalAction(async () => {
  const result = await portal.auth.signOut()
  if (!result.ok) {
    fail(failure(result.failure))
    return
  }
  await portal.refreshAccount()
  await router.replace({ name: 'welcome' })
})
const error = computed(() => acceptFailure.value ?? declineFailure.value)
</script>

<template>
  <PortalTerms
    v-if="legal"
    :host="portal.host"
    :legal="legal"
    :accepting="accepting || declining"
    :error="error"
    @accept="accept()"
    @decline="decline()"
  />
</template>
