<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { CloudPortalAPIError } from '@open-pencil/cloud/client'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { portalURL } from '@/app/cloud-portal/navigation'
import { usePortalAction, usePortalLoad } from '@/app/cloud-portal/state'
import { useDateFormat } from '@/app/i18n/date'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalEmailDialog from '../account/PortalEmailDialog.vue'
import PortalPasswordDialog from '../account/PortalPasswordDialog.vue'
import PortalProfile from '../account/PortalProfile.vue'

/** The query the email confirmation link comes back with. */
const EMAIL_CONFIRMED = 'email-confirmed'

/**
 * The signed-in person's name, email, and picture. A new email is confirmed from the new
 * address; a session that signed in a while ago signs in again with its password first.
 */
const portal = usePortal()
const route = useRoute()
const router = useRouter()
const messages = useCloudPortalMessages()
const failures = usePortalFailureMessages()
const dates = useDateFormat()

const loaded = usePortalLoad(async () => {
  const [{ profile }, methods] = await Promise.all([
    portal.api.profile(),
    portal.api.authenticationMethods()
  ])
  return {
    profile,
    hasPassword: methods.methods.some((method) => method.provider === 'credential')
  }
}, null)
const profile = computed(() => {
  const value = loaded.data.value?.profile
  return value
    ? {
        id: value.id,
        name: value.name,
        email: value.email,
        image: value.image,
        memberSince: dates.format(value.createdAt, 'date')
      }
    : null
})
const notice = ref<string | null>(null)

const rename = usePortalAction(async (name: string) => {
  notice.value = null
  await portal.api.updateProfile(name)
  await Promise.all([loaded.reload(), portal.refreshAccount()])
  notice.value = messages.value.nameSaved
})

const emailOpen = ref(false)
const passwordOpen = ref(false)
/** The address waiting for a fresh sign-in before it can be asked for. */
let pendingEmail = ''

async function requestEmail(email: string) {
  await portal.api.changeEmail(email, portalURL(`/account?${EMAIL_CONFIRMED}`))
  emailOpen.value = false
  passwordOpen.value = false
  notice.value = messages.value.emailChangeSent({ email })
}

const changeEmail = usePortalAction(async (email: string) => {
  notice.value = null
  try {
    await requestEmail(email)
  } catch (error) {
    const stale = error instanceof CloudPortalAPIError && error.code === 'session_not_fresh'
    if (!stale || !loaded.data.value?.hasPassword) throw error
    pendingEmail = email
    emailOpen.value = false
    passwordOpen.value = true
  }
})

const confirmPassword = usePortalAction(async (password: string) => {
  const email = portal.account.value?.user.email ?? ''
  const signedIn = await portal.auth.withEmail({ email, password })
  if (!signedIn.ok) {
    confirmPassword.fail(failures.failure(signedIn.failure))
    return
  }
  if (signedIn.value === 'two-step') {
    confirmPassword.fail(failures.failure('session-not-fresh'))
    return
  }
  await requestEmail(pendingEmail)
})

const busy = computed(
  () =>
    loaded.loading.value ||
    rename.busy.value ||
    changeEmail.busy.value ||
    confirmPassword.busy.value
)
const error = computed(() => rename.error.value ?? loaded.error.value)

function openEmail() {
  changeEmail.clear()
  emailOpen.value = true
}

onMounted(async () => {
  if (!(EMAIL_CONFIRMED in route.query)) return
  await router.replace({ query: {} })
  await portal.refreshAccount()
  const email = portal.account.value?.user.email
  if (email) notice.value = messages.value.emailChanged({ email })
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <AppAlert v-if="notice" tone="success" :heading="notice" />
    <PortalProfile
      v-if="profile"
      :profile="profile"
      :email-change-available="loaded.data.value?.profile.emailChangeAvailable"
      :busy="busy"
      @rename="rename.run"
      @change-email="openEmail"
    />
    <PortalEmailDialog
      v-if="profile"
      v-model:open="emailOpen"
      :current-email="profile.email"
      :error="changeEmail.error.value"
      :saving="busy"
      @submit="changeEmail.run"
    />
    <PortalPasswordDialog
      :open="passwordOpen"
      purpose="confirm"
      :error="confirmPassword.error.value"
      :saving="busy"
      @update:open="(open) => !open && ((passwordOpen = false), confirmPassword.clear())"
      @submit="({ current }) => confirmPassword.run(current)"
    />
  </div>
</template>
