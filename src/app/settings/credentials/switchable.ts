import {
  CredentialStoreError,
  type CredentialRef,
  type CredentialStore
} from '@/app/settings/credentials/types'

export type CredentialStoreSwitchOptions = {
  clearPrevious?: boolean
}

export class SwitchableCredentialStore implements CredentialStore {
  #delegate: CredentialStore

  constructor(delegate: CredentialStore) {
    this.#delegate = delegate
  }

  get backend() {
    return this.#delegate.backend
  }

  availability() {
    return this.#delegate.availability()
  }

  status(reference: CredentialRef) {
    return this.#delegate.status(reference)
  }

  read(reference: CredentialRef) {
    return this.#delegate.read(reference)
  }

  write(reference: CredentialRef, value: string) {
    return this.#delegate.write(reference, value)
  }

  remove(reference: CredentialRef) {
    return this.#delegate.remove(reference)
  }

  async switchTo(
    next: CredentialStore,
    references: CredentialRef[],
    options: CredentialStoreSwitchOptions = {}
  ): Promise<void> {
    const previous = this.#delegate
    if (next.backend === previous.backend) return

    const values = await Promise.all(references.map((reference) => previous.read(reference)))
    try {
      for (const [index, reference] of references.entries()) {
        const value = values[index]
        if (value === null) continue
        await next.write(reference, value)
        if ((await next.read(reference)) !== value) {
          throw new CredentialStoreError('failed', 'Credential copy verification failed')
        }
      }
    } catch (error) {
      await Promise.allSettled(references.map((reference) => next.remove(reference)))
      throw error
    }

    if (options.clearPrevious) {
      try {
        await Promise.all(references.map((reference) => previous.remove(reference)))
      } catch (error) {
        const restoration = await Promise.allSettled(
          references.map(async (reference, index) => {
            const value = values[index]
            if (value !== null) await previous.write(reference, value)
          })
        )
        const restored = restoration.every((result) => result.status === 'fulfilled')
        if (restored) {
          await Promise.allSettled(references.map((reference) => next.remove(reference)))
        } else {
          this.#delegate = next
        }
        throw error
      }
    }

    this.#delegate = next
  }
}
