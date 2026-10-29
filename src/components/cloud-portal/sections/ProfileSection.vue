<script setup lang="ts">
import { fromUint8Array } from 'js-base64'
import * as v from 'valibot'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { CloudPortalAPIError } from '@open-pencil/cloud/client'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { portalURL } from '@/app/cloud-portal/navigation'
import { usePortalAction, usePortalLoad } from '@/app/cloud-portal/state'
import { portalToast } from '@/app/cloud-portal/toast'
import { useDateFormat } from '@/app/i18n/date'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'

import PortalFieldDialog from '../account/PortalFieldDialog.vue'
import PortalPasswordDialog from '../account/PortalPasswordDialog.vue'
import PortalPictureDialog from '../account/PortalPictureDialog.vue'
import PortalProfile from '../account/PortalProfile.vue'
import PortalLoadAlert from '../layout/PortalLoadAlert.vue'
import PortalPageSkeleton from '../layout/PortalPageSkeleton.vue'

/** The query the email confirmation link comes back with. */
const EMAIL_CONFIRMED = 'email-confirmed'
/** The longest name the server keeps. */
const NAME_MAX_LENGTH = 100

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
const nameOpen = ref(false)
const nameSchema = computed(() =>
  v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(messages.value.errorNameRequired),
    v.maxLength(NAME_MAX_LENGTH)
  )
)
const emailSchema = computed(() =>
  v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(messages.value.errorEmailRequired),
    v.email(messages.value.errorEmailInvalid)
  )
)

const rename = usePortalAction(async (name: string) => {
  if (name !== profile.value?.name) {
    await portal.api.updateProfile(name)
    await Promise.all([loaded.reload(), portal.refreshAccount()])
    portalToast.info(messages.value.nameSaved)
  }
  nameOpen.value = false
})

function openName() {
  rename.clear()
  nameOpen.value = true
}

const pictureFile = ref<File | null>(null)
const pictureOpen = ref(false)

function choosePicture(file: File) {
  savePicture.clear()
  pictureFile.value = file
  pictureOpen.value = true
}

const savePicture = usePortalAction(async (picture: Blob) => {
  await portal.api.uploadPicture(fromUint8Array(new Uint8Array(await picture.arrayBuffer())))
  pictureOpen.value = false
  await Promise.all([loaded.reload(), portal.refreshAccount()])
  portalToast.info(messages.value.pictureSaved)
})

const removeOpen = ref(false)
const removePicture = usePortalAction(async () => {
  await portal.api.removePicture()
  await Promise.all([loaded.reload(), portal.refreshAccount()])
  portalToast.info(messages.value.pictureRemoved)
})
watch(removePicture.error, (failure) => failure && portalToast.error(failure))

const emailOpen = ref(false)
const passwordOpen = ref(false)
/** The address waiting for a fresh sign-in before it can be asked for. */
let pendingEmail = ''

async function requestEmail(email: string) {
  await portal.api.changeEmail(email, portalURL(`/account?${EMAIL_CONFIRMED}`))
  emailOpen.value = false
  passwordOpen.value = false
  portalToast.info(messages.value.emailChangeSent({ email }))
}

const changeEmail = usePortalAction(async (email: string) => {
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
    rename.busy.value ||
    savePicture.busy.value ||
    removePicture.busy.value ||
    changeEmail.busy.value ||
    confirmPassword.busy.value
)

function openEmail() {
  changeEmail.clear()
  emailOpen.value = true
}

onMounted(async () => {
  if (!(EMAIL_CONFIRMED in route.query)) return
  await router.replace({ query: {} })
  await portal.refreshAccount()
  const email = portal.account.value?.user.email
  if (email) portalToast.info(messages.value.emailChanged({ email }))
})
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4" :aria-busy="loaded.loading.value || undefined">
    <PortalLoadAlert
      v-if="loaded.error.value"
      :error="loaded.error.value"
      @retry="loaded.reload()"
    />
    <PortalProfile
      v-if="profile"
      :profile="profile"
      :email-change-available="loaded.data.value?.profile.emailChangeAvailable"
      :busy="busy"
      @change-name="openName"
      @change-email="openEmail"
      @choose-picture="choosePicture"
      @remove-picture="removeOpen = true"
    />
    <PortalPageSkeleton v-else-if="loaded.status.value === 'loading'" avatar :groups="[2, 1]" />
    <AppConfirmationDialog
      v-model:open="removeOpen"
      tone="danger"
      :heading="messages.removePictureHeading"
      :description="messages.removePictureDescription"
      :cancel-label="messages.cancel"
      :confirm-label="messages.removePictureConfirm"
      :confirm-loading="removePicture.busy.value"
      @confirm="removePicture.run()"
    />
    <PortalPictureDialog
      v-model:open="pictureOpen"
      :file="pictureFile"
      :saving="savePicture.busy.value"
      :error="savePicture.error.value"
      @save="savePicture.run"
    />
    <PortalFieldDialog
      v-if="profile"
      v-model:open="nameOpen"
      :heading="messages.changeNameTitle"
      :description="messages.detailsSectionDescription"
      :label="messages.name"
      :submit-label="messages.save"
      :schema="nameSchema"
      :initial="profile.name"
      autocomplete="name"
      :maxlength="NAME_MAX_LENGTH"
      :error="rename.error.value"
      :saving="rename.busy.value"
      @submit="rename.run"
    />
    <PortalFieldDialog
      v-if="profile"
      v-model:open="emailOpen"
      :heading="messages.changeEmailTitle"
      :description="messages.changeEmailDescription({ email: profile.email })"
      :label="messages.newEmail"
      :submit-label="messages.sendConfirmation"
      :schema="emailSchema"
      type="email"
      autocomplete="email"
      :placeholder="messages.emailPlaceholder"
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
