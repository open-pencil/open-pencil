<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'

import type { CloudAuthenticationMethods } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages, useI18n } from '@open-pencil/vue'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { portalDate } from '@/app/cloud-portal/format'
import { portalURL } from '@/app/cloud-portal/navigation'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalAccountSecurity from '../account/PortalAccountSecurity.vue'
import PortalAuthenticatorSetup from '../account/PortalAuthenticatorSetup.vue'
import PortalPasswordDialog from '../account/PortalPasswordDialog.vue'
import PortalRecoveryCodes from '../account/PortalRecoveryCodes.vue'
import type { PortalSignInMethod } from '../types'

/** The signed-in person's sign-in methods and second steps, with every change they can make. */
const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()
const failures = usePortalFailureMessages()

const methods = shallowRef<CloudAuthenticationMethods | null>(null)
type MFAStatus = Awaited<ReturnType<typeof portal.api.mfaStatus>>['mfa']
type Passkey = Awaited<ReturnType<typeof portal.api.passkeys>>['passkeys'][number]
const mfa = shallowRef<MFAStatus | null>(null)
const passkeys = shallowRef<Passkey[]>([])
const busy = ref(false)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)

type PasswordStep = 'change' | 'enable-authenticator' | 'disable-authenticator' | 'recovery-codes'
const passwordStep = ref<PasswordStep | null>(null)
const passwordError = ref<string | null>(null)
const setupURI = ref<string | null>(null)
const setupError = ref<string | null>(null)
const recoveryCodes = ref<string[] | null>(null)

const hasPassword = computed(
  () => methods.value?.methods.some((method) => method.provider === 'credential') ?? false
)
const linkedMethods = computed(() =>
  (methods.value?.methods ?? []).map((method) => ({
    id: method.id,
    provider: method.provider,
    linkedOn: portalDate(method.createdAt, locale.value),
    canUnlink: method.canUnlink
  }))
)
const linkable = computed<PortalSignInMethod[]>(() =>
  (methods.value?.availableSocialProviders ?? []).filter(
    (provider) => !methods.value?.methods.some((method) => method.provider === provider)
  )
)
const minimum = computed(
  () => portal.discovery.authentication.emailPassword?.minimumPasswordLength ?? 15
)

async function load() {
  const [loadedMethods, loadedMFA, loadedPasskeys] = await Promise.all([
    portal.api.authenticationMethods(),
    portal.api.mfaStatus(),
    portal.api.passkeys()
  ])
  methods.value = loadedMethods
  mfa.value = loadedMFA.mfa
  passkeys.value = loadedPasskeys.passkeys
}

/** Runs one change, shows what went wrong if it fails, and reloads what the page shows. */
async function run(change: () => Promise<void>) {
  busy.value = true
  error.value = null
  notice.value = null
  try {
    await change()
    await load()
  } catch (cause) {
    error.value = failures.api(cause)
  } finally {
    busy.value = false
  }
}

async function link(provider: PortalSignInMethod) {
  await run(async () => {
    const { url } = await portal.api.linkSocial(provider, portalURL('/account'))
    globalThis.location.assign(url)
  })
}

function changePassword() {
  if (hasPassword.value) {
    passwordError.value = null
    passwordStep.value = 'change'
    return
  }
  const email = portal.account.value?.user.email
  if (!email) return
  void run(async () => {
    await portal.api.requestPasswordReset(email, portalURL('/auth/reset-password'))
    notice.value = messages.value.passwordResetSent
  })
}

/** Steps that need the current password when the account has one. */
function withPassword(step: Exclude<PasswordStep, 'change'>) {
  if (hasPassword.value) {
    passwordError.value = null
    passwordStep.value = step
    return
  }
  void finishPasswordStep(step, undefined)
}

async function finishPasswordStep(step: PasswordStep, password: string | undefined, next = '') {
  busy.value = true
  passwordError.value = null
  try {
    if (step === 'change') await portal.api.changePassword(password ?? '', next)
    else if (step === 'enable-authenticator') {
      const enabled = await portal.api.enableTOTP(password)
      setupURI.value = enabled.totpURI
      recoveryCodes.value = null
      pendingCodes = enabled.backupCodes
    } else if (step === 'disable-authenticator') await portal.api.disableTOTP(password)
    else recoveryCodes.value = (await portal.api.regenerateRecoveryCodes(password)).backupCodes
    passwordStep.value = null
    await load()
  } catch (cause) {
    if (passwordStep.value) passwordError.value = failures.api(cause)
    else error.value = failures.api(cause)
  } finally {
    busy.value = false
  }
}

let pendingCodes: string[] = []

async function verifyAuthenticator(code: string) {
  busy.value = true
  setupError.value = null
  try {
    await portal.api.verifyTOTP(code.trim())
    setupURI.value = null
    recoveryCodes.value = pendingCodes
    pendingCodes = []
    await load()
  } catch (cause) {
    setupError.value = failures.api(cause)
  } finally {
    busy.value = false
  }
}

async function addPasskey() {
  await run(async () => {
    const result = await portal.auth.addPasskey()
    if (!result.ok) error.value = failures.failure(result.failure)
  })
}

onMounted(() => void run(async () => undefined))
</script>

<template>
  <div class="flex flex-col gap-4">
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <AppAlert v-if="notice" tone="success" :heading="notice" />
    <PortalAccountSecurity
      v-if="methods && mfa"
      :methods="linkedMethods"
      :linkable="linkable"
      :authenticator="{ available: mfa.totpAvailable, on: mfa.enabled }"
      :passkeys="
        passkeys.map((passkey) => ({
          id: passkey.id,
          name: passkey.name ?? null,
          addedOn: portalDate(passkey.createdAt, locale)
        }))
      "
      :passkeys-available="mfa.passkeysAvailable"
      :two-step-required="mfa.required && !mfa.enabled && passkeys.length === 0"
      :busy="busy"
      @link="link"
      @unlink="(id) => run(() => portal.api.unlinkAuthenticationMethod(id).then(() => undefined))"
      @change-password="changePassword"
      @set-up-authenticator="withPassword('enable-authenticator')"
      @turn-off-authenticator="withPassword('disable-authenticator')"
      @new-recovery-codes="withPassword('recovery-codes')"
      @add-passkey="addPasskey"
      @remove-passkey="(id) => run(() => portal.api.deletePasskey(id).then(() => undefined))"
    />

    <PortalPasswordDialog
      :open="passwordStep !== null"
      :purpose="passwordStep === 'change' ? 'change' : 'confirm'"
      :minimum-password-length="minimum"
      :error="passwordError"
      :saving="busy"
      @update:open="(open) => !open && (passwordStep = null)"
      @submit="
        ({ current, next }) => passwordStep && finishPasswordStep(passwordStep, current, next)
      "
    />
    <PortalAuthenticatorSetup
      v-if="setupURI"
      :open="true"
      :uri="setupURI"
      :error="setupError"
      :verifying="busy"
      @update:open="(open) => !open && (setupURI = null)"
      @verify="verifyAuthenticator"
    />
    <PortalRecoveryCodes
      v-if="recoveryCodes"
      :open="true"
      :codes="recoveryCodes"
      @update:open="(open) => !open && (recoveryCodes = null)"
    />
  </div>
</template>
