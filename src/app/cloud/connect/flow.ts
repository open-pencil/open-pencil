import { computed, ref, shallowRef } from 'vue'

import {
  CloudClientError,
  resendCloudVerification,
  signInToCloudWithEmail,
  signUpToCloudWithEmail,
  type CloudAuthFailure,
  type CloudDiscoveryFailure
} from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import { IS_TAURI, OFFICIAL_CLOUD_URL } from '@/constants'

import { normalizeCloudServerURL } from '../servers/address'
import { addCloudServer, findCloudServer, type CloudServer } from '../servers/store'
import type { CloudAccountCredentials } from '../sessions/account-form'
import { cloudFetch, discoverCloudServer, refreshCloudConnection } from '../sessions/connection'
import { createCloudDeviceSignIn } from '../sessions/device'
import {
  cloudSignInRoute,
  redirectToCloudSignIn,
  type CloudSignInMethod
} from '../sessions/sign-in'
import { saveCloudSessionToken } from '../sessions/token'

export type CloudConnectStep = 'server' | 'checking' | 'sign-in' | 'sign-up' | 'verify' | 'device'
export type CloudConnectError = CloudDiscoveryFailure | 'denied' | 'expired' | 'sign-in-failed'

type CheckedServer = { url: string; kind: CloudServer['kind']; discovery: CloudDiscovery }

export const cloudConnectOpen = ref(false)
export const cloudConnectStep = ref<CloudConnectStep>('server')
export const cloudConnectKind = ref<CloudServer['kind']>('official')
/** Whether the dialog asks which server to use; Settings already asked when it names one. */
export const cloudConnectChoosing = ref(true)
export const cloudConnectAddress = ref('')
export const cloudConnectError = ref<CloudConnectError | null>(null)
/** Why the email form's last attempt failed. */
export const cloudConnectFailure = ref<CloudAuthFailure | null>(null)
export const cloudConnectBusy = ref(false)
/** The address a verification link went to, while the dialog waits for it to be opened. */
export const cloudConnectEmail = ref('')
export const cloudConnectResent = ref(false)
const checked = shallowRef<CheckedServer | null>(null)
/** Kept only while waiting for the email to be verified, to finish signing in afterwards. */
let awaitingVerification: CloudAccountCredentials | null = null
const device = createCloudDeviceSignIn()
export const cloudDeviceSignIn = device.state
/** The last sign-in that finished, for whoever opened the dialog to react to. */
export const cloudSignedIn = shallowRef<{ serverId: string } | null>(null)
let generation = 0

/**
 * The checked server's host and how to sign in to it. Email and password happen in the dialog
 * wherever the server accepts this app's requests: the desktop app and the server's own editor.
 */
export const cloudConnectServer = computed(() => {
  const server = checked.value
  if (!server) return null
  const authentication = server.discovery.authentication
  const route = cloudSignInRoute(server.discovery)
  const emailPassword = authentication.emailPassword?.signIn ? authentication.emailPassword : null
  const inline = emailPassword && (IS_TAURI || route === 'redirect') ? emailPassword : null
  const methods: CloudSignInMethod[] = [...authentication.socialProviders]
  if (emailPassword && !inline) methods.push('email')
  return {
    host: new URL(server.url).host,
    methods,
    route,
    emailPassword: inline
      ? { signUp: inline.signUp, minimumPasswordLength: inline.minimumPasswordLength }
      : null,
    approvalRequired: authentication.enrollmentMode === 'approval'
  }
})

/** Whether Back has somewhere to go from the current step. */
export const cloudConnectCanGoBack = computed(() => {
  const step = cloudConnectStep.value
  if (step === 'sign-up' || step === 'verify') return true
  if (step === 'sign-in') return cloudConnectChoosing.value || cloudConnectKind.value !== 'official'
  return false
})

function resetAttempt(): void {
  cloudConnectError.value = null
  cloudConnectFailure.value = null
  cloudConnectBusy.value = false
  cloudConnectResent.value = false
  awaitingVerification = null
}

async function check(url: string, kind: CloudServer['kind']): Promise<void> {
  const attempt = ++generation
  cloudConnectStep.value = 'checking'
  cloudConnectError.value = null
  try {
    const discovery = await discoverCloudServer(url)
    if (attempt !== generation) return
    checked.value = { url, kind, discovery }
    cloudConnectStep.value = 'sign-in'
  } catch (error) {
    if (attempt !== generation) return
    cloudConnectError.value = error instanceof CloudClientError ? error.reason : 'unreachable'
    cloudConnectStep.value = 'server'
  }
}

/**
 * Opens the connect dialog: on the server choice, on one kind of server Settings already chose,
 * or on signing in to a server this app knows, such as one whose sign-in expired.
 */
export function openCloudConnect(options: { kind?: CloudServer['kind']; serverId?: string } = {}) {
  device.cancel()
  checked.value = null
  resetAttempt()
  cloudConnectOpen.value = true
  const known = options.serverId ? findCloudServer(options.serverId) : null
  if (known) {
    cloudConnectChoosing.value = false
    cloudConnectKind.value = known.kind
    cloudConnectAddress.value = known.kind === 'self-hosted' ? known.url : ''
    void check(known.url, known.kind)
    return
  }
  cloudConnectChoosing.value = !options.kind
  cloudConnectKind.value = options.kind ?? 'official'
  cloudConnectAddress.value = ''
  if (options.kind === 'official') {
    void check(OFFICIAL_CLOUD_URL, 'official')
    return
  }
  cloudConnectStep.value = 'server'
}

/**
 * Signs in to a known server to open something only an account may: on the server's own editor,
 * its sign-in page, in place of this one and coming back to it, so no dialog stands in front of an
 * editor with nothing in it; anywhere else the connect dialog.
 */
export async function signInToOpen(serverId: string): Promise<void> {
  const server = findCloudServer(serverId)
  const discovery = server ? await discoverCloudServer(server.url).catch(() => null) : null
  if (discovery && cloudSignInRoute(discovery) === 'redirect') {
    redirectToCloudSignIn(serverId, discovery, { replace: true })
    return
  }
  openCloudConnect({ serverId })
}

/** Checks the chosen server answers as OpenPencil Cloud before asking anyone to sign in. */
export function continueCloudConnect(): void {
  const url =
    cloudConnectKind.value === 'official'
      ? OFFICIAL_CLOUD_URL
      : normalizeCloudServerURL(cloudConnectAddress.value)
  if (!url) {
    cloudConnectError.value = 'invalid-address'
    return
  }
  void check(url, cloudConnectKind.value)
}

export function backCloudConnect(): void {
  const step = cloudConnectStep.value
  cloudConnectFailure.value = null
  if (step === 'sign-up' || step === 'verify') {
    awaitingVerification = null
    cloudConnectStep.value = 'sign-in'
    return
  }
  generation++
  device.cancel()
  checked.value = null
  resetAttempt()
  cloudConnectStep.value = 'server'
}

export function showCloudSignUp(): void {
  cloudConnectFailure.value = null
  cloudConnectStep.value = 'sign-up'
}

export function cancelCloudConnect(): void {
  generation++
  device.cancel()
  resetAttempt()
  cloudConnectOpen.value = false
}

async function finishSignIn(server: CloudServer): Promise<void> {
  awaitingVerification = null
  await refreshCloudConnection(server)
  cloudSignedIn.value = { serverId: server.id }
  cloudConnectOpen.value = false
}

/**
 * Signs in to the checked server in the browser, remembering it first: a browser on the server's
 * own editor leaves for the server's pages and comes back; everything else approves a code.
 */
export async function signInToCloudServer(method: CloudSignInMethod): Promise<void> {
  const target = checked.value
  if (!target) return
  // Changing the server or cancelling starts a new generation; this attempt then stops.
  const attempt = generation
  cloudConnectError.value = null
  const server = await addCloudServer({ kind: target.kind, url: target.url })
  if (attempt !== generation) return
  if (cloudSignInRoute(target.discovery) === 'redirect') {
    redirectToCloudSignIn(server.id, target.discovery, { method })
    return
  }
  cloudConnectStep.value = 'device'
  const signedIn = await device.start(server.id, target.discovery, cloudFetch)
  if (attempt !== generation) return
  if (signedIn) {
    await finishSignIn(server)
    return
  }
  const outcome = device.state.value.status
  if (outcome === 'idle') return
  cloudConnectError.value =
    outcome === 'denied' || outcome === 'expired' ? outcome : 'sign-in-failed'
  cloudConnectStep.value = 'sign-in'
}

/**
 * Signs in with an email and password in the dialog and keeps the session's token. An account
 * with two-step sign-in finishes in the browser, where the server asks for the second step.
 */
export async function signInWithCloudEmail(credentials: CloudAccountCredentials): Promise<void> {
  const target = checked.value
  if (!target || cloudConnectBusy.value) return
  const attempt = generation
  cloudConnectBusy.value = true
  cloudConnectFailure.value = null
  const result = await signInToCloudWithEmail(target.discovery, credentials, { fetch: cloudFetch })
  if (attempt !== generation) return
  cloudConnectBusy.value = false
  if (!result.ok) {
    if (result.failure === 'email-not-verified') {
      awaitingVerification = credentials
      cloudConnectEmail.value = credentials.email
      // Coming back without having opened the link says so on the same step.
      if (cloudConnectStep.value === 'verify') cloudConnectFailure.value = result.failure
      cloudConnectStep.value = 'verify'
      return
    }
    cloudConnectFailure.value = result.failure
    return
  }
  if (result.value.status === 'two-step') {
    await signInToCloudServer('email')
    return
  }
  const server = await addCloudServer({ kind: target.kind, url: target.url })
  if (attempt !== generation) return
  await saveCloudSessionToken(server.id, result.value.token)
  await finishSignIn(server)
}

/** The page the verification link opens: the server's own, saying to come back here. */
function verifiedURL(target: CheckedServer): string {
  return new URL('/auth/verified', target.url).href
}

export async function signUpWithCloudEmail(credentials: CloudAccountCredentials): Promise<void> {
  const target = checked.value
  if (!target || cloudConnectBusy.value) return
  const attempt = generation
  cloudConnectBusy.value = true
  cloudConnectFailure.value = null
  const result = await signUpToCloudWithEmail(
    target.discovery,
    { ...credentials, verifiedURL: verifiedURL(target) },
    { fetch: cloudFetch }
  )
  if (attempt !== generation) return
  cloudConnectBusy.value = false
  if (!result.ok) {
    cloudConnectFailure.value = result.failure
    return
  }
  awaitingVerification = credentials
  cloudConnectEmail.value = credentials.email
  cloudConnectResent.value = false
  cloudConnectStep.value = 'verify'
}

/** Tries the sign-in again once the person says, or shows by coming back, that they verified. */
export function continueAfterCloudVerification(): Promise<void> {
  if (cloudConnectStep.value !== 'verify' || !awaitingVerification) return Promise.resolve()
  return signInWithCloudEmail(awaitingVerification)
}

export async function resendCloudVerificationEmail(): Promise<void> {
  const target = checked.value
  if (!target || !cloudConnectEmail.value || cloudConnectBusy.value) return
  cloudConnectBusy.value = true
  cloudConnectFailure.value = null
  const result = await resendCloudVerification(
    target.discovery,
    { email: cloudConnectEmail.value, verifiedURL: verifiedURL(target) },
    { fetch: cloudFetch }
  )
  cloudConnectBusy.value = false
  if (result.ok) cloudConnectResent.value = true
  else cloudConnectFailure.value = result.failure
}

/** The server's own page for choosing a new password, opened in a browser. */
export function cloudForgotPasswordURL(): string | null {
  const target = checked.value
  return target ? new URL('/auth/forgot-password', target.url).href : null
}

export function reopenCloudSignInPage(): Promise<void> {
  return device.reopen()
}
