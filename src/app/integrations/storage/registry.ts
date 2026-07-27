import { credentialRef } from '@/app/settings/credentials/reference'

import type {
  StorageAdapter,
  StorageAdapterContext,
  StorageFieldID,
  StorageProviderID,
  StorageProviderRegistration
} from './types'

export class StorageProviderRegistry {
  readonly #registrations: ReadonlyMap<StorageProviderID, StorageProviderRegistration>

  constructor(registrations: readonly StorageProviderRegistration[]) {
    const entries = registrations.map((registration) => [registration.id, registration] as const)
    const ids = new Set(entries.map(([id]) => id))
    if (ids.size !== entries.length) throw new Error('Storage provider IDs must be unique')
    this.#registrations = new Map(entries)
  }

  list(): readonly StorageProviderRegistration[] {
    return [...this.#registrations.values()]
  }

  get(id: StorageProviderID): StorageProviderRegistration {
    const registration = this.#registrations.get(id)
    if (!registration) throw new Error(`Unknown storage provider: ${id}`)
    return registration
  }

  createAdapter(id: StorageProviderID, context: StorageAdapterContext): StorageAdapter {
    const registration = this.get(id)
    const credentialFields = new Set(registration.credentialFields.map((field) => field.id))
    const profileId = context.profileId ?? 'default'

    return registration.createAdapter({
      preferences: context.preferences,
      resolveCredential(field: StorageFieldID) {
        if (!credentialFields.has(field)) {
          return Promise.reject(new Error(`Unknown credential field for ${id}: ${field}`))
        }
        return context.credentials.resolve(credentialRef(id, field, profileId))
      }
    })
  }
}

export function defineStorageProvider(
  registration: StorageProviderRegistration
): StorageProviderRegistration {
  return registration
}
