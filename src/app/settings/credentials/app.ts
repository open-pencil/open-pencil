import { ref } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'

import { BrowserCredentialStore } from '@/app/settings/credentials/browser'
import { MemoryCredentialStore } from '@/app/settings/credentials/memory'
import { NativeCredentialStore } from '@/app/settings/credentials/native'
import { createCredentialServices } from '@/app/settings/credentials/services'
import {
  browserRemembersCredentials,
  hasLegacyCredentialStorage,
  setBrowserRemembersCredentials
} from '@/app/settings/credentials/storage'
import { SwitchableCredentialStore } from '@/app/settings/credentials/switchable'
import type { CredentialRef, CredentialStore } from '@/app/settings/credentials/types'

const legacyCredentialsPresent = hasLegacyCredentialStorage()
if (legacyCredentialsPresent) setBrowserRemembersCredentials(true)

export const browserCredentialsRemembered = ref(
  !IS_TAURI && (browserRemembersCredentials() || legacyCredentialsPresent)
)

function initialCredentialStore(): CredentialStore {
  if (IS_TAURI) return new NativeCredentialStore()
  if (browserCredentialsRemembered.value) return new BrowserCredentialStore()
  return new MemoryCredentialStore()
}

export const appCredentialStore = new SwitchableCredentialStore(initialCredentialStore())
export const appCredentialServices = createCredentialServices(appCredentialStore)

export async function setBrowserCredentialPersistence(
  remembered: boolean,
  references: CredentialRef[]
): Promise<void> {
  if (IS_TAURI) return

  const next = remembered ? new BrowserCredentialStore() : new MemoryCredentialStore()
  await appCredentialStore.switchTo(next, references, { clearPrevious: !remembered })

  browserCredentialsRemembered.value = remembered
  setBrowserRemembersCredentials(remembered)
}
