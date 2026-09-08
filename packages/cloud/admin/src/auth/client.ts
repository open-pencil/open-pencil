import {
  signInToCloud,
  signOutFromCloud,
  type CloudSocialProvider
} from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

export type CloudAuthProvider = CloudSocialProvider

export type CloudAuthIntent = 'sign-in' | 'sign-up'

export async function startSocialAuthentication(
  discovery: CloudDiscovery,
  provider: CloudAuthProvider,
  intent: CloudAuthIntent,
  callbackURL: string
): Promise<void> {
  const target = new URL(callbackURL, globalThis.location.origin)
  target.searchParams.set('auth_intent', intent)
  await signInToCloud(discovery, provider, { callbackURL: target.href })
}

export async function endCloudSession(discovery: CloudDiscovery): Promise<void> {
  await signOutFromCloud(discovery)
  globalThis.location.assign('/')
}
