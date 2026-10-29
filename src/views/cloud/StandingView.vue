<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { openLocalEditor } from '@/app/cloud-portal/site'
import PortalNotice from '@/components/cloud-portal/auth/PortalNotice.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

const portal = usePortal()
const route = useRoute()
const router = useRouter()
const messages = useCloudPortalMessages()
const pending = computed(() => route.name === 'pending')
const email = computed(() => portal.account.value?.user.email ?? '')

async function signOut() {
  await portal.auth.signOut()
  await portal.refreshAccount()
  await router.replace({ name: 'welcome' })
}
</script>

<template>
  <PortalNotice
    :host="portal.host"
    :tone="pending ? 'waiting' : 'neutral'"
    :heading="pending ? messages.pendingTitle : messages.closedTitle"
    :description="pending ? messages.pendingDescription({ email }) : messages.closedDescription"
  >
    <template #icon>
      <icon-lucide-clock v-if="pending" class="size-6" />
      <icon-lucide-ban v-else class="size-6" />
    </template>
    <template v-if="portal.account.value" #actions>
      <AppButton
        v-if="portal.discovery.localEditor"
        size="lg"
        variant="outline"
        class="w-full"
        @click="openLocalEditor()"
      >
        {{ messages.useWithoutAccount }}
      </AppButton>
      <AppButton size="lg" variant="ghost" class="w-full" @click="signOut">
        {{ messages.signOut }}
      </AppButton>
    </template>
  </PortalNotice>
</template>
