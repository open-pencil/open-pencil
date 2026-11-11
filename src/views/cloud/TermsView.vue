<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalAccountDeletion } from '@/app/cloud-portal/deletion'
import { continuationPath } from '@/app/cloud-portal/navigation'
import { usePortalTerms } from '@/app/cloud-portal/terms'
import { portalToast } from '@/app/cloud-portal/toast'
import PortalDeleteAccountDialog from '@/components/cloud-portal/account/PortalDeleteAccountDialog.vue'
import PortalNotice from '@/components/cloud-portal/auth/PortalNotice.vue'
import PortalTerms from '@/components/cloud-portal/auth/PortalTerms.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

/**
 * The server's terms, which an account accepts before it uses the server when the server asks it
 * to, and again whenever their version changes. Accepting goes on to where it was going, declining
 * signs out, and leaving downloads its documents and deletes the account.
 */
const portal = usePortal()
const messages = useCloudPortalMessages()
const route = useRoute()
const router = useRouter()

const { legal, busy, error, accept, decline } = usePortalTerms({
  onAccepted: () => router.replace(continuationPath(route.query.redirect)),
  onSignedOut: () => router.replace({ name: 'welcome' })
})

// A session too old to delete with says to sign in again, which brings the person back here.
const deletion = usePortalAccountDeletion({
  async onDeleted() {
    portalToast.info(messages.value.accountDeleted)
    await router.replace({ name: 'welcome' })
  },
  onArchiveFailed: (message) => portalToast.error(message)
})

/** A page loaded before the server named its terms has none to show; reading them again does. */
function reload() {
  globalThis.location.reload()
}
</script>

<template>
  <PortalTerms
    v-if="legal"
    :host="portal.host"
    :legal="legal"
    :accepting="busy"
    :error="error"
    @accept="accept"
    @decline="decline"
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
