import { ref, type Ref } from 'vue'

import { CloudPortalAPIError } from '@open-pencil/cloud/client'
import type { CloudAccountDeletion } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { saveAccountArchive, type PortalAccountArchive } from './archive'
import { usePortal } from './context'
import { usePortalFailureMessages } from './failure'
import { usePortalAction } from './state'

export type PortalAccountDeletionOptions = {
  /** The account is gone and nobody is signed in: the page says so and leaves. */
  onDeleted(): unknown
  /** Download all failed as a whole, such as out of memory, and saved nothing. */
  onArchiveFailed(message: string): void
  /**
   * A session too old to delete with: show a password prompt and say whether it did. Without one,
   * the failure asks to sign in again.
   */
  confirmPassword?(): boolean
}

/**
 * Deleting the signed-in account, as the account page and the terms page offer it: what goes,
 * downloading every document first, and the deletion itself. It reports what happened; the page
 * says so and moves on.
 */
export function usePortalAccountDeletion(options: PortalAccountDeletionOptions) {
  const portal = usePortal()
  const messages = useCloudPortalMessages()
  const failures = usePortalFailureMessages()
  const open = ref(false)
  const deletion: Ref<CloudAccountDeletion | null> = ref(null)
  const loadError = ref<string | null>(null)
  const archive = ref<PortalAccountArchive | null>(null)
  /** Which opening of the dialog a download belongs to, so a stale one can't write into a newer. */
  let session = 0

  async function show() {
    session++
    remove.clear()
    deletion.value = null
    loadError.value = null
    archive.value = null
    open.value = true
    try {
      deletion.value = (await portal.api.accountDeletion()).deletion
    } catch (error) {
      loadError.value = failures.api(error)
    }
  }

  async function downloadAll() {
    const opening = session
    const documents = deletion.value?.documents ?? []
    const current = () => opening === session
    archive.value = { done: 0, total: documents.length, saved: null, failed: [] }
    try {
      const result = await saveAccountArchive(documents, {
        apiURL: portal.discovery.apiURL,
        archiveName: `${messages.value.accountArchiveName({ host: portal.host })}.zip`,
        onProgress: ({ done, total }) => {
          if (current() && archive.value) archive.value = { ...archive.value, done, total }
        }
      })
      if (!current()) return
      archive.value = {
        done: documents.length,
        total: documents.length,
        saved: result.saved,
        failed: result.failed.map((document) => document.name)
      }
    } catch (error) {
      // Zipping or saving failed as a whole, such as out of memory; nothing was saved.
      if (!current()) return
      archive.value = null
      options.onArchiveFailed(failures.api(error))
    }
  }

  /** Deletes the account, with the password when the session is too old. */
  async function finish(password?: string) {
    await portal.api.deleteAccount(password)
    open.value = false
    await portal.refreshAccount()
    await options.onDeleted()
  }

  const remove = usePortalAction(async () => {
    try {
      await finish()
    } catch (error) {
      if (!(error instanceof CloudPortalAPIError)) throw error
      if (error.code === 'account_sole_admin') {
        // Someone else's change stopped it meanwhile; show which workspaces need another admin.
        deletion.value = (await portal.api.accountDeletion()).deletion
        throw error
      }
      if (error.code !== 'session_not_fresh' || !options.confirmPassword?.()) throw error
    }
  })

  return { open, deletion, loadError, archive, show, downloadAll, finish, remove }
}
