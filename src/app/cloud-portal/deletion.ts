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
  /** Which opening of the dialog a plan request belongs to, so a stale one can't fill a newer. */
  let opening = 0
  /**
   * Whether Download all is still running. It outlives closing the dialog: reopening shows its
   * progress, and deleting stays blocked, until it ends.
   */
  let downloading = false

  async function show() {
    const current = ++opening
    remove.clear()
    deletion.value = null
    loadError.value = null
    if (!downloading) archive.value = null
    open.value = true
    try {
      const plan = (await portal.api.accountDeletion()).deletion
      if (current === opening) deletion.value = plan
    } catch (error) {
      if (current === opening) loadError.value = failures.api(error)
    }
  }

  async function downloadAll() {
    if (downloading) return
    downloading = true
    const documents = deletion.value?.documents ?? []
    archive.value = { done: 0, total: documents.length, saved: null, failed: [] }
    try {
      const result = await saveAccountArchive(documents, {
        apiURL: portal.discovery.apiURL,
        archiveName: `${messages.value.accountArchiveName({ host: portal.host })}.zip`,
        onProgress: ({ done, total }) => {
          if (archive.value) archive.value = { ...archive.value, done, total }
        }
      })
      archive.value = {
        done: documents.length,
        total: documents.length,
        saved: result.saved,
        failed: result.failed.map((document) => document.name)
      }
    } catch (error) {
      // Zipping or saving failed as a whole, such as out of memory; nothing was saved.
      archive.value = null
      options.onArchiveFailed(failures.api(error))
    } finally {
      downloading = false
    }
  }

  /** Deletes the account, with the password when the session is too old. */
  async function finish(password?: string) {
    await portal.api.deleteAccount(password)
    open.value = false
    // The account is gone either way; a status check that fails now must not keep the page on it.
    await portal.refreshAccount().catch(() => {
      portal.account.value = null
    })
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
