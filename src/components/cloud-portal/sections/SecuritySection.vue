<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCloudPortalMessages, useI18n } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { portalURL } from '@/app/cloud-portal/navigation'
import { usePortalAction, usePortalLoad } from '@/app/cloud-portal/state'
import { portalToast } from '@/app/cloud-portal/toast'
import { formatDate } from '@/app/i18n/date'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import { useHeldContent } from '@/components/ui/overlay/held'

import PortalAccountSecurity from '../account/PortalAccountSecurity.vue'
import PortalAuthenticatorSetup from '../account/PortalAuthenticatorSetup.vue'
import PortalPasswordDialog from '../account/PortalPasswordDialog.vue'
import PortalRecoveryCodes from '../account/PortalRecoveryCodes.vue'
import PortalLoadAlert from '../layout/PortalLoadAlert.vue'
import PortalPageSkeleton from '../layout/PortalPageSkeleton.vue'
import type { PortalSignInMethod } from '../types'

/** The signed-in person's sign-in methods and second steps, with every change they can make. */
const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()
const failures = usePortalFailureMessages()

const security = usePortalLoad(async () => {
  const [methods, mfa, passkeys] = await Promise.all([
    portal.api.authenticationMethods(),
    portal.api.mfaStatus(),
    portal.api.passkeys()
  ])
  return { methods, mfa: mfa.mfa, passkeys: passkeys.passkeys }
}, null)
const methods = computed(() => security.data.value?.methods ?? null)
const mfa = computed(() => security.data.value?.mfa ?? null)
const passkeys = computed(() => security.data.value?.passkeys ?? [])

type PasswordStep =
  | 'change'
  | 'enable-authenticator'
  | 'disable-authenticator'
  | 'recovery-codes'
  | 'add-passkey'
const passwordStep = ref<PasswordStep | null>(null)
const setupURI = ref<string | null>(null)
const recoveryCodes = ref<string[] | null>(null)
/** Recovery codes from turning the authenticator on, shown once its first code is verified. */
let pendingCodes: string[] = []

const hasPassword = computed(
  () => methods.value?.methods.some((method) => method.provider === 'credential') ?? false
)
const linkedMethods = computed(() =>
  (methods.value?.methods ?? []).map((method) => ({
    id: method.id,
    provider: method.provider,
    linkedOn: formatDate(method.createdAt, 'date', locale.value),
    canUnlink: method.canUnlink
  }))
)
const linkable = computed<PortalSignInMethod[]>(() =>
  (methods.value?.availableSocialProviders ?? []).filter(
    (provider) => !methods.value?.methods.some((method) => method.provider === provider)
  )
)
const minimum = computed(
  () => portal.discovery.authentication.emailPassword?.minimumPasswordLength ?? 8
)

/** One change from the page, then what the page shows read again. */
const change = usePortalAction(async (work: () => Promise<unknown>) => {
  await work()
  await security.reload()
})

const verifyAction = usePortalAction(async (code: string) => {
  await portal.api.verifyTOTP(code.trim())
  setupURI.value = null
  recoveryCodes.value = pendingCodes
  pendingCodes = []
  await security.reload()
})

/**
 * Adding a passkey needs a recent sign-in, so a stale session signs in again with the password
 * first; an account that also asks for a second step has to sign in again in full.
 */
async function addPasskeyAfterSignIn(password: string): Promise<string | null> {
  const email = portal.account.value?.user.email ?? ''
  const signedIn = await portal.auth.withEmail({ email, password })
  if (!signedIn.ok) return failures.failure(signedIn.failure)
  if (signedIn.value === 'two-step') return failures.failure('session-not-fresh')
  const added = await portal.auth.addPasskey()
  return added.ok ? null : failures.failure(added.failure)
}

/** A step behind the password dialog; its failure shows in the dialog while it is open. */
const passwordAction = usePortalAction(
  async (step: PasswordStep, password: string | undefined, next: string) => {
    if (step === 'add-passkey') {
      const failure = await addPasskeyAfterSignIn(password ?? '')
      if (failure) {
        passwordAction.fail(failure)
        return
      }
      passwordStep.value = null
      await security.reload()
      return
    }
    let setup: { totpURI: string; backupCodes: string[] } | null = null
    let codes: string[] | null = null
    if (step === 'change') await portal.api.changePassword(password ?? '', next)
    else if (step === 'enable-authenticator') setup = await portal.api.enableTOTP(password)
    else if (step === 'disable-authenticator') await portal.api.disableTOTP(password)
    else codes = (await portal.api.regenerateRecoveryCodes(password)).backupCodes
    // The step succeeded: close the password dialog before showing what comes next.
    passwordStep.value = null
    if (setup) {
      verifyAction.clear()
      recoveryCodes.value = null
      pendingCodes = setup.backupCodes
      setupURI.value = setup.totpURI
    }
    if (codes) recoveryCodes.value = codes
    await security.reload()
  }
)

const busy = computed(
  () => change.busy.value || passwordAction.busy.value || verifyAction.busy.value
)
const passwordError = computed(() => (passwordStep.value ? passwordAction.error.value : null))
const passwordShown = useHeldContent(passwordStep)
const passwordErrorShown = useHeldContent(passwordError, () => passwordStep.value !== null)
const setupShown = useHeldContent(setupURI)
const codesShown = useHeldContent(recoveryCodes)
const error = computed(
  () => change.error.value ?? (passwordStep.value ? null : passwordAction.error.value)
)

function link(provider: PortalSignInMethod) {
  void change.run(async () => {
    const { url } = await portal.api.linkSocial(provider, portalURL('/account/security'))
    globalThis.location.assign(url)
  })
}

function openPasswordStep(step: PasswordStep) {
  passwordAction.clear()
  passwordStep.value = step
}

/** A failure inside the dialog stays with it; closing the dialog drops it. */
function closePasswordStep() {
  passwordStep.value = null
  passwordAction.clear()
}

function changePassword() {
  if (hasPassword.value) {
    openPasswordStep('change')
    return
  }
  const email = portal.account.value?.user.email
  if (!email) return
  void change.run(async () => {
    const result = await portal.auth.requestPasswordReset(email, portalURL('/auth/reset-password'))
    if (result.ok) portalToast.info(messages.value.passwordResetSent)
    else change.fail(failures.failure(result.failure))
  })
}

/** Steps that need the current password when the account has one. */
function withPassword(step: Exclude<PasswordStep, 'change'>) {
  if (hasPassword.value) openPasswordStep(step)
  else void passwordAction.run(step, undefined, '')
}

/** Closing setup before the code is verified leaves the authenticator off, so its codes go too. */
function closeAuthenticatorSetup() {
  setupURI.value = null
  pendingCodes = []
}

function addPasskey() {
  void change.run(async () => {
    const result = await portal.auth.addPasskey()
    if (result.ok) return
    if (result.failure === 'session-not-fresh' && hasPassword.value) openPasswordStep('add-passkey')
    else change.fail(failures.failure(result.failure))
  })
}
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4" :aria-busy="security.loading.value || undefined">
    <PortalLoadAlert
      v-if="security.error.value"
      :error="security.error.value"
      @retry="security.reload()"
    />
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <PortalAccountSecurity
      v-if="methods && mfa"
      :methods="linkedMethods"
      :linkable="linkable"
      :authenticator="{ available: mfa.totpAvailable, on: mfa.enabled }"
      :passkeys="
        passkeys.map((passkey) => ({
          id: passkey.id,
          name: passkey.name ?? null,
          addedOn: formatDate(passkey.createdAt, 'date', locale)
        }))
      "
      :passkeys-available="mfa.passkeysAvailable"
      :two-step-required="mfa.required && !mfa.enabled && passkeys.length === 0"
      :busy="busy"
      @link="link"
      @unlink="(id) => change.run(() => portal.api.unlinkAuthenticationMethod(id))"
      @change-password="changePassword"
      @set-up-authenticator="withPassword('enable-authenticator')"
      @turn-off-authenticator="withPassword('disable-authenticator')"
      @new-recovery-codes="withPassword('recovery-codes')"
      @add-passkey="addPasskey"
      @remove-passkey="(id) => change.run(() => portal.api.deletePasskey(id))"
    />
    <PortalPageSkeleton v-else-if="security.status.value === 'loading'" :groups="[2, 2, 1]" />

    <PortalPasswordDialog
      :open="passwordStep !== null"
      :purpose="passwordShown === 'change' ? 'change' : 'confirm'"
      :minimum-password-length="minimum"
      :error="passwordErrorShown"
      :saving="busy"
      @update:open="(open) => !open && closePasswordStep()"
      @submit="
        ({ current, next }) => passwordStep && passwordAction.run(passwordStep, current, next)
      "
    />
    <PortalAuthenticatorSetup
      :open="setupURI !== null"
      :uri="setupShown ?? ''"
      :error="verifyAction.error.value"
      :verifying="busy"
      @update:open="(open) => !open && closeAuthenticatorSetup()"
      @verify="verifyAction.run"
    />
    <PortalRecoveryCodes
      :open="recoveryCodes !== null"
      :codes="codesShown ?? []"
      @update:open="(open) => !open && (recoveryCodes = null)"
    />
  </div>
</template>
