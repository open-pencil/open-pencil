import type {
  CredentialManager,
  CredentialResolver,
  CredentialStore
} from '@/app/settings/credentials/types'

export type CredentialServices = {
  manager: CredentialManager
  resolver: CredentialResolver
}

export function createCredentialServices(store: CredentialStore): CredentialServices {
  return {
    manager: {
      get backend() {
        return store.backend
      },
      availability: () => store.availability(),
      status: (reference) => store.status(reference),
      set: (reference, value) => store.write(reference, value),
      clear: (reference) => store.remove(reference)
    },
    resolver: {
      resolve: (reference) => store.read(reference)
    }
  }
}
