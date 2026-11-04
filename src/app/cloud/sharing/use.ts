import { ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'

import type { DocumentPermission } from '@open-pencil/cloud/contract'

import {
  changeCloudLink,
  changeCloudMember,
  cloudLinkURL,
  inviteToCloudDocument,
  readCloudSharing,
  resetCloudLink,
  type cloudShareTarget,
  type CloudShareLink,
  type CloudSharing
} from './document'

type ShareTarget = NonNullable<ReturnType<typeof cloudShareTarget>>

/** Which document on which server, for which account: what the sharing on show belongs to. */
function identityOf(target: ShareTarget | null): string | null {
  return target ? `${target.server.id}\u0000${target.accountId}\u0000${target.documentId}` : null
}

/**
 * Who can open a Cloud document and its link, as its server keeps them, and the changes the share
 * dialog makes. Each change reads the sharing again, so the dialog shows what the server kept;
 * operations report whether they worked and leave telling the person to the caller.
 */
export function useCloudSharing(target: MaybeRefOrGetter<ShareTarget | null>) {
  const sharing = shallowRef<CloudSharing | null>(null)
  /**
   * The document's link, ready before anyone asks: a share sheet opens only straight from a tap,
   * so the link cannot be fetched after it.
   */
  const linkURL = shallowRef<string | null>(null)
  const inviting = ref(false)
  // Each read is numbered so a slower earlier one never replaces a newer one.
  let latestRead = 0

  // Another document's members and link never show, or take changes, while this one's load.
  watch(
    () => identityOf(toValue(target)),
    () => {
      sharing.value = null
      linkURL.value = null
    }
  )

  /**
   * Reads the document's sharing, then its link; false when either could not be read. Members and
   * access show even when the link does not, which then stays empty rather than out of date.
   */
  async function refresh(): Promise<boolean> {
    const current = toValue(target)
    if (!current) return true
    const read = ++latestRead
    const still = () => read === latestRead && identityOf(toValue(target)) === identityOf(current)
    let next: CloudSharing
    try {
      next = await readCloudSharing(current)
    } catch {
      return !still()
    }
    if (!still()) return true
    sharing.value = next
    if (next.link.access !== 'link') {
      linkURL.value = null
      return true
    }
    try {
      const url = await cloudLinkURL(current)
      if (still()) linkURL.value = url
      return true
    } catch {
      if (still()) linkURL.value = null
      return !still()
    }
  }

  /**
   * Runs a change on the server and reads what it left; false when the change failed or what it
   * left could not be read. The link is dropped first, since a change such as a reset retires it.
   */
  async function change(run: (current: ShareTarget) => Promise<void>): Promise<boolean> {
    const current = toValue(target)
    if (!current) return true
    linkURL.value = null
    let changed = true
    try {
      await run(current)
    } catch {
      changed = false
    }
    const read = await refresh()
    return changed && read
  }

  async function invite(email: string, permission: DocumentPermission): Promise<boolean> {
    inviting.value = true
    try {
      return await change((current) => inviteToCloudDocument(current, email, permission))
    } finally {
      inviting.value = false
    }
  }

  return {
    sharing,
    linkURL,
    inviting,
    refresh,
    invite,
    changeMember: (id: string, permission: DocumentPermission | 'remove') =>
      change((current) => changeCloudMember(current, id, permission)),
    changeLink: (link: CloudShareLink) => change((current) => changeCloudLink(current, link)),
    resetLink: () => change((current) => resetCloudLink(current))
  }
}
