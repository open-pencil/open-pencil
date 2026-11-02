import { noop } from 'es-toolkit'
import { computed } from 'vue'

import type { CloudAIClient } from '@open-pencil/cloud/client'
import type { WorkspaceSummary } from '@open-pencil/cloud/contract'

import type { CloudAIWorkspace } from '@/app/cloud/ai/access'
import type { CloudAccount } from '@/app/cloud/servers/store'
import type { SaveDestination, SaveFailure } from '@/app/storage/save-to/model'

/**
 * What a build without Cloud (`VITE_OPENPENCIL_CLOUD=off`) resolves `@/app/cloud/integration`
 * to: the same names, offering nothing. Only types come from Cloud's modules, so none of its code
 * is bundled.
 */
export const CLOUD_INCLUDED: boolean = false

// Still the identifier Home and Save to compare locations with; no provider registers it.
export { CLOUD_STORAGE_PROVIDER_ID } from '@/app/cloud/sessions/token'

/** Nothing opens from a Cloud link without Cloud. */
export const openingCloudLink = computed(() => false)

export type { CloudAIWorkspace } from '@/app/cloud/ai/access'

export const cloudAIAvailable = computed(() => false)
export const cloudAIIdentity = computed<string | null>(() => null)
export const cloudBillingURL = computed<string | null>(() => null)

export function cloudAIClient(): CloudAIClient | null {
  return null
}

export async function cloudAIWorkspaces(): Promise<CloudAIWorkspace[]> {
  return []
}

export function startCloud(): () => void {
  return noop
}

export function isCloudBinding(): boolean {
  return false
}

export function cloudDocumentAddress(): { path: string; query: Record<string, string> } | null {
  return null
}

export function isVersionHistoryOpen(): boolean {
  return false
}

export function openCloudShare(): boolean {
  return false
}
export const openVersionDialog = noop
export const openVersionHistory = noop

export function shownEditorStore<Store>(store: Store): Store {
  return store
}

export function versionPreviewKey(): string {
  return ''
}

export async function cloudSaveDestinations(): Promise<SaveDestination[]> {
  return []
}

export function signInToSaveTo(): boolean {
  return false
}

export async function cloudUploadFailure(): Promise<SaveFailure | null> {
  return null
}

export function useHomeCloud() {
  return {
    signedIn: computed(() => false),
    checking: computed(() => false),
    account: computed<(CloudAccount & { host: string }) | null>(() => null),
    workspaces: computed<WorkspaceSummary[]>(() => []),
    serverId: computed<string | null>(() => null),
    connect: noop,
    openAccount: noop,
    newWorkspace: noop,
    signOut: () => Promise.resolve()
  }
}
