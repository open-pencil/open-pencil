import { computed, ref, shallowRef, type Ref } from 'vue'

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
/**
 * Download all for this tab's account, one at a time and shared by every page that offers deleting
 * it: closing the dialog or going from the terms page to the account page neither hides how it went
 * nor unblocks deleting while it runs.
 */
const download = {
  /** Whose download it is: another account signed in to this tab sees none of it. */
  owner: shallowRef<string | null>(null),
  archive: ref<PortalAccountArchive | null>(null),
  /** The documents the last download set out to save. */
  covered: shallowRef<ReadonlySet<string>>(new Set()),
  running: false
}

export function usePortalAccountDeletion(options: PortalAccountDeletionOptions) {
  const portal = usePortal()
  const messages = useCloudPortalMessages()
  const failures = usePortalFailureMessages()
  const open = ref(false)
  const deletion: Ref<CloudAccountDeletion | null> = ref(null)
  const loadError = ref<string | null>(null)
  /**
   * The shared download as this plan sees it: documents the plan has that the download did not set
   * out to save, such as one added meanwhile, count as not saved.
   */
  const accountId = computed(() => portal.account.value?.user.userId ?? null)
  const archive = computed<PortalAccountArchive | null>(() => {
    if (download.owner.value !== accountId.value) return null
    const current = download.archive.value
    if (!current || current.saved === null || !deletion.value) return current
    const missing = deletion.value.documents
      .filter((document) => !download.covered.value.has(document.id))
      .map((document) => document.name)
    return missing.length > 0 ? { ...current, failed: [...current.failed, ...missing] } : current
  })
  /** Which opening of the dialog a plan request belongs to, so a stale one can't fill a newer. */
  let opening = 0

  async function show() {
    const current = ++opening
    remove.clear()
    deletion.value = null
    loadError.value = null
    open.value = true
    try {
      const plan = (await portal.api.accountDeletion()).deletion
      if (current === opening) deletion.value = plan
    } catch (error) {
      if (current === opening) loadError.value = failures.api(error)
    }
  }

  /** Set while the account is being deleted, which no download may start during. */
  const finishing = ref(false)

  async function downloadAll() {
    if (download.running || finishing.value || remove.busy.value) return
    download.running = true
    download.owner.value = accountId.value
    const documents = deletion.value?.documents ?? []
    download.covered.value = new Set(documents.map((document) => document.id))
    download.archive.value = { done: 0, total: documents.length, saved: null, failed: [] }
    try {
      const result = await saveAccountArchive(documents, {
        apiURL: portal.discovery.apiURL,
        archiveName: `${messages.value.accountArchiveName({ host: portal.host })}.zip`,
        onProgress: ({ done, total }) => {
          const current = download.archive.value
          if (current) download.archive.value = { ...current, done, total }
        }
      })
      // The person closed the save picker: nothing was saved, and nothing went wrong.
      if (!result) {
        download.archive.value = null
        return
      }
      download.archive.value = {
        done: documents.length,
        total: documents.length,
        saved: result.saved,
        failed: result.failed.map((document) => document.name)
      }
    } catch (error) {
      // Zipping or saving failed as a whole, such as out of memory or a full disk.
      download.archive.value = null
      options.onArchiveFailed(failures.api(error))
    } finally {
      download.running = false
    }
  }

  /** Deletes the account, with the password when the session is too old. */
  async function finish(password?: string) {
    finishing.value = true
    try {
      await portal.api.deleteAccount(password)
    } finally {
      finishing.value = false
    }
    open.value = false
    // The account's download goes with it, unless one is still running, which keeps its own state.
    if (!download.running) {
      download.owner.value = null
      download.archive.value = null
      download.covered.value = new Set()
    }
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

  /** Deleting, whether from the dialog or after a password prompt. */
  const deleting = computed(() => remove.busy.value || finishing.value)

  return { open, deletion, loadError, archive, deleting, show, downloadAll, finish, remove }
}
