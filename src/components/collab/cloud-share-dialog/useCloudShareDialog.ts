import { useClipboard } from '@vueuse/core'
import { computed, ref, watch, type Ref } from 'vue'

import type {
  CloudUserProfile,
  DocumentAccess,
  DocumentGrant,
  DocumentInvitation,
  DocumentPermission,
  DocumentShare
} from '@open-pencil/cloud/contract'

import {
  createCloudShare,
  inviteCloudUser,
  loadCloudShareState,
  rotateCloudShare,
  revokeCloudGrant,
  revokeCloudInvitation,
  revokeCloudShare,
  updateCloudGrant,
  updateCloudShare
} from '@/app/collab/cloud-sharing'
import type { EditorStore } from '@/app/editor/session'
import { toast } from '@/app/shell/ui'

export const permissionOptions = [
  { label: 'Can view', value: 'view' },
  { label: 'Can edit', value: 'edit' }
]
export const expirationOptions = [
  { label: 'Never', value: 'never' },
  { label: '1 day', value: '1' },
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' }
]

export function useCloudShareDialog(open: Ref<boolean>, store: EditorStore) {
  const { copy } = useClipboard({ copiedDuring: 2000 })
  const access = ref<DocumentAccess | null>(null)
  const shares = ref<DocumentShare[]>([])
  const grants = ref<DocumentGrant[]>([])
  const grantProfiles = ref<Record<string, CloudUserProfile>>({})
  const invitations = ref<DocumentInvitation[]>([])
  const inviteEmail = ref('')
  const invitePermission = ref<DocumentPermission>('view')
  const linkPermission = ref<DocumentPermission>('view')
  const expiration = ref('never')
  const loading = ref(false)
  const settingsOpen = ref(false)
  const oneTimeLink = ref('')
  const activeShare = computed(() => shares.value[0] ?? null)
  const canManage = computed(() => access.value?.canManageSharing ?? false)
  const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

  async function refresh() {
    loading.value = true
    try {
      const state = await loadCloudShareState(store)
      access.value = state.access
      shares.value = state.shares
      grants.value = state.grants
      const profiles = await Promise.all(
        state.grants.map(async (grant) => {
          const profile = await state.client.getUserProfile(grant.documentId, grant.userId)
          return profile ? ([grant.userId, profile] as const) : null
        })
      )
      grantProfiles.value = Object.fromEntries(
        profiles.filter((entry): entry is readonly [string, CloudUserProfile] => entry !== null)
      )
      invitations.value = state.invitations
      if (state.shares[0]) linkPermission.value = state.shares[0].permission
    } catch (error) {
      toast.error(`Could not load sharing: ${errorMessage(error)}`)
    } finally {
      loading.value = false
    }
  }

  async function invite() {
    const email = inviteEmail.value.trim()
    if (!email) return
    loading.value = true
    try {
      const state = await loadCloudShareState(store)
      const user = await state.client.lookupUser(state.binding.documentId, { email })
      if (user) {
        const existing = grants.value.find((grant) => grant.userId === user.id)
        const grant = await updateCloudGrant(store, user.id, invitePermission.value)
        grants.value = existing
          ? grants.value.map((item) => (item.id === existing.id ? grant : item))
          : [...grants.value, grant]
        grantProfiles.value = { ...grantProfiles.value, [user.id]: user }
        toast.info(existing ? 'Access updated' : 'Access granted')
      } else {
        invitations.value.push(
          await inviteCloudUser(store, { email, permission: invitePermission.value })
        )
        toast.info('Invitation created')
      }
      inviteEmail.value = ''
    } catch (error) {
      toast.error(`Could not invite person: ${errorMessage(error)}`)
    } finally {
      loading.value = false
    }
  }

  const expirationDate = () =>
    expiration.value === 'never'
      ? null
      : new Date(Date.now() + Number(expiration.value) * 24 * 60 * 60_000).toISOString()

  async function createLink() {
    loading.value = true
    try {
      const result = await createCloudShare(store, {
        permission: linkPermission.value,
        expiresAt: expirationDate()
      })
      shares.value = [result.share, ...shares.value]
      oneTimeLink.value = result.url
      await copy(result.url)
      toast.info('Link copied. Save it now; it cannot be displayed again.')
    } catch (error) {
      toast.error(`Could not create link: ${errorMessage(error)}`)
    } finally {
      loading.value = false
    }
  }

  async function rotateLink() {
    const share = shares.value.at(0)
    if (share == null) return
    loading.value = true
    try {
      const result = await rotateCloudShare(store, share.id)
      shares.value = shares.value.map((item) => (item.id === share.id ? result.share : item))
      oneTimeLink.value = result.url
      await copy(result.url)
      toast.info('New link copied. The previous link no longer works.')
    } catch (error) {
      toast.error(`Could not regenerate link: ${errorMessage(error)}`)
    } finally {
      loading.value = false
    }
  }

  async function disableLink() {
    const share = shares.value.at(0)
    if (share == null) return
    try {
      await revokeCloudShare(store, share.id)
      shares.value = shares.value.filter((item) => item.id !== share.id)
      oneTimeLink.value = ''
      toast.info('Link access disabled')
    } catch (error) {
      toast.error(`Could not disable link: ${errorMessage(error)}`)
    }
  }

  async function saveSettings() {
    const share = shares.value.at(0)
    if (share == null) await createLink()
    else {
      try {
        const updated = await updateCloudShare(store, share.id, {
          permission: linkPermission.value,
          expiresAt: expirationDate()
        })
        shares.value = shares.value.map((item) => (item.id === share.id ? updated : item))
        toast.info('Share settings saved')
      } catch (error) {
        toast.error(`Could not save sharing: ${errorMessage(error)}`)
      }
    }
    settingsOpen.value = false
  }

  async function mutateAccess(action: () => Promise<void>, message: string) {
    loading.value = true
    try {
      await action()
    } catch (error) {
      toast.error(`${message}: ${errorMessage(error)}`)
    } finally {
      loading.value = false
    }
  }

  const changeGrant = (grant: DocumentGrant, permission: DocumentPermission) =>
    mutateAccess(async () => {
      const updated = await updateCloudGrant(store, grant.userId, permission)
      grants.value = grants.value.map((item) => (item.id === grant.id ? updated : item))
    }, 'Could not update access')
  const removeGrant = (grant: DocumentGrant) =>
    mutateAccess(async () => {
      await revokeCloudGrant(store, grant.userId)
      grants.value = grants.value.filter((item) => item.id !== grant.id)
    }, 'Could not remove access')
  const removeInvitation = (invitation: DocumentInvitation) =>
    mutateAccess(async () => {
      await revokeCloudInvitation(store, invitation.id)
      invitations.value = invitations.value.filter((item) => item.id !== invitation.id)
    }, 'Could not revoke invitation')

  watch(open, (isOpen) => {
    if (isOpen) void refresh()
  })

  return {
    access,
    shares,
    grants,
    grantProfiles,
    invitations,
    inviteEmail,
    invitePermission,
    linkPermission,
    expiration,
    loading,
    settingsOpen,
    oneTimeLink,
    activeShare,
    canManage,
    invite,
    createLink,
    rotateLink,
    disableLink,
    saveSettings,
    changeGrant,
    removeGrant,
    removeInvitation
  }
}
