<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCloudPortalMessages } from '@open-pencil/vue'

import { usePortal } from '@/app/cloud-portal/context'
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
  await router.replace({ name: 'sign-in' })
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
      <icon-lucide-clock v-if="pending" class="size-5" />
      <icon-lucide-ban v-else class="size-5" />
    </template>
    <template v-if="portal.account.value" #actions>
      <AppButton variant="ghost" @click="signOut">{{ messages.signOut }}</AppButton>
    </template>
  </PortalNotice>
</template>
