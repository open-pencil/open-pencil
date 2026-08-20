<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useClipboard } from '@vueuse/core'

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
import { useEditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import {
  AppDialogBody,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'

const open = defineModel<boolean>('open', { default: false })
const store = useEditorStore()
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

const permissionOptions = [
  { label: 'Can view', value: 'view' },
  { label: 'Can edit', value: 'edit' }
]
const expirationOptions = [
  { label: 'Never', value: 'never' },
  { label: '1 day', value: '1' },
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' }
]
const activeShare = computed(() => shares.value[0] ?? null)
const canManage = computed(() => access.value?.canManageSharing ?? false)

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

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
  const share = activeShare.value
  if (!share) return
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
  const share = activeShare.value
  if (!share) return
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
  const share = activeShare.value
  if (!share) {
    await createLink()
  } else {
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

function expirationDate(): string | null {
  if (expiration.value === 'never') return null
  const days = Number(expiration.value)
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString()
}

async function changeGrant(grant: DocumentGrant, permission: DocumentPermission) {
  const updated = await updateCloudGrant(store, grant.userId, permission)
  grants.value = grants.value.map((item) => (item.id === grant.id ? updated : item))
}

async function removeGrant(grant: DocumentGrant) {
  await revokeCloudGrant(store, grant.userId)
  grants.value = grants.value.filter((item) => item.id !== grant.id)
}

async function removeInvitation(invitation: DocumentInvitation) {
  await revokeCloudInvitation(store, invitation.id)
  invitations.value = invitations.value.filter((item) => item.id !== invitation.id)
}

watch(
  open,
  (isOpen) => {
    if (isOpen) void refresh()
  },
  { immediate: false }
)
</script>

<template>
  <AppDialogRoot v-model:open="open" size="md" aria-label="Share document">
    <AppDialogHeader :heading="`Share “${store.state.documentName}”`" close-label="Close" />
    <AppDialogBody>
      <div class="flex gap-2">
        <AppInput
          v-model="inviteEmail"
          class="min-w-0 flex-1"
          type="text"
          placeholder="Email address"
          aria-label="Email address"
          :disabled="!canManage || loading"
          @enter="invite"
        />
        <AppSelect
          v-model="invitePermission"
          class="w-24"
          :options="permissionOptions"
          label="Invitation permission"
          :disabled="!canManage || loading"
        />
        <button
          type="button"
          class="rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          :disabled="!inviteEmail.trim() || !canManage || loading"
          @click="invite"
        >
          Invite
        </button>
      </div>

      <section class="mt-5">
        <h3 class="mb-2 text-xs font-medium text-surface">Who has access</h3>
        <div class="space-y-1">
          <div class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-hover">
            <span
              class="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent"
            >
              <icon-lucide-building-2 class="size-3.5" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[11px] text-surface">Workspace members</div>
              <div class="text-[9px] text-muted">Inherited access</div>
            </div>
            <span class="text-[10px] text-muted">{{
              access?.permission === 'edit' ? 'Can edit' : 'Can view'
            }}</span>
          </div>

          <div
            v-for="grant in grants"
            :key="grant.id"
            class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-hover"
          >
            <span
              class="flex size-7 items-center justify-center rounded-full bg-hover text-[10px] text-surface"
            >
              {{ (grantProfiles[grant.userId]?.name ?? grant.userId).slice(0, 2).toUpperCase() }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[11px] text-surface">
                {{ grantProfiles[grant.userId]?.name ?? grant.userId }}
              </div>
              <div v-if="grantProfiles[grant.userId]" class="truncate text-[9px] text-muted">
                {{ grantProfiles[grant.userId].email }}
              </div>
            </div>
            <AppSelect
              :model-value="grant.permission"
              class="w-24"
              :options="permissionOptions"
              label="Person permission"
              :disabled="!canManage"
              @update:model-value="changeGrant(grant, $event as DocumentPermission)"
            />
            <button
              type="button"
              class="text-muted hover:text-danger"
              aria-label="Remove access"
              @click="removeGrant(grant)"
            >
              <icon-lucide-x class="size-3.5" />
            </button>
          </div>

          <div
            v-for="invitation in invitations"
            :key="invitation.id"
            class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-hover"
          >
            <span class="flex size-7 items-center justify-center rounded-full bg-hover text-muted"
              ><icon-lucide-mail class="size-3.5"
            /></span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[11px] text-surface">{{ invitation.email }}</div>
              <div class="text-[9px] text-muted">
                {{ invitation.acceptedAt ? 'Accepted' : 'Invitation pending' }}
              </div>
            </div>
            <span class="text-[10px] text-muted">{{
              invitation.permission === 'edit' ? 'Can edit' : 'Can view'
            }}</span>
            <button
              type="button"
              class="text-muted hover:text-danger"
              aria-label="Revoke invitation"
              @click="removeInvitation(invitation)"
            >
              <icon-lucide-x class="size-3.5" />
            </button>
          </div>
        </div>
      </section>

      <section class="mt-4 border-t border-border pt-4">
        <h3 class="mb-2 text-xs font-medium text-surface">General access</h3>
        <div class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-hover">
          <span class="flex size-7 items-center justify-center rounded-full bg-hover text-muted"
            ><icon-lucide-link class="size-3.5"
          /></span>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] text-surface">
              {{ activeShare ? 'Anyone with the link' : 'Restricted' }}
            </div>
            <div class="text-[9px] text-muted">
              {{
                activeShare
                  ? activeShare.permission === 'edit'
                    ? 'Can edit'
                    : 'Can view'
                  : 'Only workspace members and invited people'
              }}
            </div>
          </div>
          <button
            type="button"
            class="rounded px-2 py-1 text-[10px] text-muted hover:bg-hover hover:text-surface"
            :disabled="!canManage"
            @click="settingsOpen = true"
          >
            Share settings
          </button>
        </div>
        <p
          v-if="oneTimeLink"
          class="mt-2 rounded border border-border bg-canvas px-2 py-1.5 text-[10px] text-muted"
        >
          This link is shown once. Copy it now or regenerate it later.
        </p>
      </section>
    </AppDialogBody>
    <AppDialogFooter>
      <button
        v-if="activeShare"
        type="button"
        class="mr-auto rounded px-2 py-1.5 text-[11px] text-danger hover:bg-hover"
        :disabled="!canManage"
        @click="disableLink"
      >
        Disable link
      </button>
      <button
        v-if="activeShare"
        type="button"
        class="rounded border border-border px-3 py-1.5 text-[11px] text-surface hover:bg-hover"
        :disabled="!canManage || loading"
        @click="rotateLink"
      >
        Regenerate link
      </button>
      <button
        v-else
        type="button"
        class="rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90"
        :disabled="!canManage || loading"
        @click="createLink"
      >
        Create and copy link
      </button>
    </AppDialogFooter>
  </AppDialogRoot>

  <AppDialogRoot v-model:open="settingsOpen" size="sm" aria-label="Share settings">
    <AppDialogHeader heading="Share settings" close-label="Close" />
    <AppDialogBody class="space-y-5">
      <section>
        <h3 class="mb-2 text-xs font-medium text-surface">Who has access</h3>
        <div class="rounded border border-border bg-panel-field px-3 py-2 text-[11px] text-surface">
          {{ activeShare ? 'Anyone with the link' : 'Only invited people' }}
        </div>
      </section>
      <section>
        <h3 class="mb-2 text-xs font-medium text-surface">What they can do</h3>
        <AppSelect v-model="linkPermission" :options="permissionOptions" label="Link permission" />
      </section>
      <section>
        <h3 class="mb-2 text-xs font-medium text-surface">Link expiration</h3>
        <AppSelect v-model="expiration" :options="expirationOptions" label="Link expiration" />
      </section>
      <section class="border-t border-border pt-4">
        <h3 class="text-xs font-medium text-surface">Advanced</h3>
        <p class="mt-1 text-[10px] leading-relaxed text-muted">
          Viewers can inspect and export the locally loaded document. Strong server-enforced live
          write restrictions require a trusted collaboration relay.
        </p>
      </section>
    </AppDialogBody>
    <AppDialogFooter>
      <button
        type="button"
        class="rounded px-3 py-1.5 text-[11px] text-muted hover:bg-hover"
        @click="settingsOpen = false"
      >
        Cancel
      </button>
      <button
        type="button"
        class="rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90"
        @click="saveSettings"
      >
        Save
      </button>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
