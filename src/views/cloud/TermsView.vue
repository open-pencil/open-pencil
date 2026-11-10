<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalAccountDeletion } from '@/app/cloud-portal/deletion'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { continuationPath } from '@/app/cloud-portal/navigation'
import { usePortalAction } from '@/app/cloud-portal/state'
import PortalDeleteAccountDialog from '@/components/cloud-portal/account/PortalDeleteAccountDialog.vue'
import PortalNotice from '@/components/cloud-portal/auth/PortalNotice.vue'
import PortalTerms from '@/components/cloud-portal/auth/PortalTerms.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

/**
 * The server's terms, which an account accepts before it uses the server when the server asks it
 * to, and again whenever their version changes. Declining signs out.
 */
const portal = usePortal()
const messages = useCloudPortalMessages()
const route = useRoute()
const router = useRouter()
const { failure } = usePortalFailureMessages()
const legal = computed(() => portal.discovery.legal)

// Accepting names the version this page loaded; terms replaced since then answer `terms_changed`,
// which asks for a reload to read the new ones.
const {
  busy: accepting,
  error: acceptFailure,
  run: accept,
  clear: clearAccept
} = usePortalAction(async () => {
  clearDecline()
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
  fail,
  clear: clearDecline
} = usePortalAction(async () => {
  // Only the latest attempt's failure is shown.
  clearAccept()
  const result = await portal.auth.signOut()
  if (!result.ok) {
    fail(failure(result.failure))
    return
  }
  await portal.refreshAccount()
  await router.replace({ name: 'welcome' })
})
const error = computed(() => declineFailure.value ?? acceptFailure.value)

/** A page loaded before the server named its terms has none to show; reading them again does. */
function reload() {
  globalThis.location.reload()
}

// Leaving without accepting: download every document, then delete the account. A session too old
// to delete with says to sign in again, which brings the person back here.
const deletion = usePortalAccountDeletion()
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
    @leave="deletion.show"
  />
  <PortalNotice
    v-else
    :host="portal.host"
    :heading="messages.termsTitle"
    :description="messages.termsChanged"
  >
    <template #icon>
      <icon-lucide-scroll-text class="size-6" />
    </template>
    <template #actions>
      <AppButton size="lg" color="primary" variant="solid" class="w-full" @click="reload">
        {{ messages.tryAgain }}
      </AppButton>
    </template>
  </PortalNotice>
  <PortalDeleteAccountDialog
    v-if="portal.account.value"
    v-model:open="deletion.open.value"
    :email="portal.account.value.user.email"
    :deletion="deletion.deletion.value"
    :load-error="deletion.loadError.value"
    :archive="deletion.archive.value"
    :error="deletion.remove.error.value"
    :deleting="deletion.remove.busy.value"
    @download-all="deletion.downloadAll"
    @confirm="deletion.remove.run()"
  />
</template>
