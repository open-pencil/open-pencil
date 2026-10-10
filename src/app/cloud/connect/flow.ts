import { computed, ref, shallowRef } from 'vue'

import { CloudClientError, type CloudDiscoveryFailure } from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import { OFFICIAL_CLOUD_URL } from '@/constants'

import { normalizeCloudServerURL } from '../servers/address'
import { addCloudServer, findCloudServer, type CloudServer } from '../servers/store'
import { cloudFetch, discoverCloudServer, refreshCloudConnection } from '../sessions/connection'
import { createCloudDeviceSignIn } from '../sessions/device'
import {
  cloudSignInRoute,
  redirectToCloudSignIn,
  type CloudSignInMethod
} from '../sessions/sign-in'

export type CloudConnectStep = 'server' | 'checking' | 'sign-in' | 'device'
export type CloudConnectError = CloudDiscoveryFailure | 'denied' | 'expired' | 'sign-in-failed'

type CheckedServer = { url: string; kind: CloudServer['kind']; discovery: CloudDiscovery }

export const cloudConnectOpen = ref(false)
export const cloudConnectStep = ref<CloudConnectStep>('server')
export const cloudConnectKind = ref<CloudServer['kind']>('official')
export const cloudConnectAddress = ref('')
export const cloudConnectError = ref<CloudConnectError | null>(null)
const checked = shallowRef<CheckedServer | null>(null)
const device = createCloudDeviceSignIn()
export const cloudDeviceSignIn = device.state
/** The last sign-in that finished, for whoever opened the dialog to react to. */
export const cloudSignedIn = shallowRef<{ serverId: string } | null>(null)
let generation = 0

/** The checked server's host and the ways it lets people sign in. */
export const cloudConnectServer = computed(() => {
  const server = checked.value
  if (!server) return null
  const authentication = server.discovery.authentication
  const methods: CloudSignInMethod[] = [...authentication.socialProviders]
  if (authentication.emailPassword?.signIn) methods.push('email')
  return {
    host: new URL(server.url).host,
    methods,
    route: cloudSignInRoute(server.discovery)
  }
})

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
 * Opens the connect dialog: on the server choice, or on signing in to a server this app already
 * knows, such as one whose sign-in expired or one an invitation names.
 */
export function openCloudConnect(options: { kind?: CloudServer['kind']; serverId?: string } = {}) {
  device.cancel()
  checked.value = null
  cloudConnectError.value = null
  cloudConnectOpen.value = true
  const known = options.serverId ? findCloudServer(options.serverId) : null
  if (known) {
    cloudConnectKind.value = known.kind
    cloudConnectAddress.value = known.kind === 'self-hosted' ? known.url : ''
    void check(known.url, known.kind)
    return
  }
  cloudConnectKind.value = options.kind ?? 'official'
  cloudConnectAddress.value = ''
  cloudConnectStep.value = 'server'
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

export function changeCloudConnectServer(): void {
  generation++
  device.cancel()
  checked.value = null
  cloudConnectError.value = null
  cloudConnectStep.value = 'server'
}

export function cancelCloudConnect(): void {
  generation++
  device.cancel()
  cloudConnectOpen.value = false
}

async function finishSignIn(server: CloudServer): Promise<void> {
  await refreshCloudConnection(server)
  cloudSignedIn.value = { serverId: server.id }
  cloudConnectOpen.value = false
}

/**
 * Signs in to the checked server, remembering it first: a browser on the server's own editor
 * leaves for the server's pages and comes back; everything else approves a code.
 */
export async function signInToCloudServer(method: CloudSignInMethod): Promise<void> {
  const target = checked.value
  if (!target) return
  cloudConnectError.value = null
  const server = await addCloudServer({ kind: target.kind, url: target.url })
  if (cloudSignInRoute(target.discovery) === 'redirect') {
    redirectToCloudSignIn(server.id, target.discovery, method)
    return
  }
  cloudConnectStep.value = 'device'
  const signedIn = await device.start(server.id, target.discovery, cloudFetch)
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

export function reopenCloudSignInPage(): Promise<void> {
  return device.reopen()
}
