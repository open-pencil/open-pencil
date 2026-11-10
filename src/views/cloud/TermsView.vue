<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { usePortal } from '@/app/cloud-portal/context'
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
const legal = computed(() => portal.discovery.legal)

// Accepting names the version this page loaded; terms replaced since then answer `terms_changed`,
// which asks for a reload to read the new ones.
const {
  busy: accepting,
  error,
  run: accept
} = usePortalAction(async () => {
  const version = legal.value?.termsVersion
  if (!version) return
  await portal.api.acceptTerms(version)
  await portal.refreshAccount()
  await router.replace(continuationPath(route.query.redirect))
})

async function decline() {
  await portal.auth.signOut()
  await portal.refreshAccount()
  await router.replace({ name: 'welcome' })
}
</script>

<template>
  <PortalTerms
    v-if="legal"
    :host="portal.host"
    :legal="legal"
    :accepting="accepting"
    :error="error"
    @accept="accept()"
    @decline="decline"
  />
</template>
