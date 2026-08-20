<script setup lang="ts">
import { computed } from 'vue'
import type { DocumentPermission } from '@open-pencil/cloud/contract'

import { useEditorStore } from '@/app/editor/active-store'
import { useButtonUI } from '@/components/ui/button'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import {
  expirationOptionValues,
  permissionOptionValues,
  useCloudShareDialog
} from './useCloudShareDialog'
import {
  AppDialogBody,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'

import { useI18n } from '@open-pencil/vue'

const open = defineModel<boolean>('open', { default: false })
const store = useEditorStore()
const { dialogs } = useI18n()
const permissionOptions = computed(() => [
  { label: dialogs.value.cloudCanView, value: permissionOptionValues[0] },
  { label: dialogs.value.cloudCanEdit, value: permissionOptionValues[1] }
])
const expirationOptions = computed(() => [
  { label: dialogs.value.cloudNever, value: expirationOptionValues[0] },
  { label: dialogs.value.cloudOneDay, value: expirationOptionValues[1] },
  { label: dialogs.value.cloudSevenDays, value: expirationOptionValues[2] },
  { label: dialogs.value.cloudThirtyDays, value: expirationOptionValues[3] }
])
const primaryButton = useButtonUI({ tone: 'accent', size: 'sm' })
const secondaryButton = useButtonUI({ tone: 'ghost', size: 'sm', bordered: true })
const quietButton = useButtonUI({ tone: 'ghost', size: 'sm' })
const {
  access,
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
} = useCloudShareDialog(open, store)
</script>

<template>
  <AppDialogRoot v-model:open="open" size="md" :aria-label="dialogs.cloudShareDocumentAria">
    <AppDialogHeader
      :heading="dialogs.cloudShareDocument({ name: store.state.documentName })"
      :close-label="dialogs.close"
    />
    <AppDialogBody>
      <div class="flex gap-2">
        <AppInput
          v-model="inviteEmail"
          class="min-w-0 flex-1"
          type="text"
          :placeholder="dialogs.cloudEmailAddress"
          :aria-label="dialogs.cloudEmailAddress"
          :disabled="!canManage || loading"
          @enter="invite"
        />
        <AppSelect
          v-model="invitePermission"
          class="w-24"
          :options="permissionOptions"
          :label="dialogs.cloudInvitationPermission"
          :disabled="!canManage || loading"
        />
        <button
          type="button"
          :class="primaryButton.base"
          :disabled="!inviteEmail.trim() || !canManage || loading"
          @click="invite"
        >
          {{ dialogs.cloudInvite }}
        </button>
      </div>

      <section class="mt-5">
        <h3 class="mb-2 text-xs font-medium text-surface">{{ dialogs.cloudWhoHasAccess }}</h3>
        <div class="space-y-1">
          <div class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-hover">
            <span
              class="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent"
            >
              <icon-lucide-building-2 class="size-3.5" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[11px] text-surface">
                {{ dialogs.cloudWorkspaceMembers }}
              </div>
              <div class="text-[9px] text-muted">{{ dialogs.cloudInheritedAccess }}</div>
            </div>
            <span class="text-[10px] text-muted">{{
              access?.permission === 'edit' ? dialogs.cloudCanEdit : dialogs.cloudCanView
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
              :label="dialogs.cloudPersonPermission"
              :disabled="!canManage"
              @update:model-value="changeGrant(grant, $event as DocumentPermission)"
            />
            <button
              type="button"
              class="text-muted hover:text-danger"
              :aria-label="dialogs.cloudRemoveAccess"
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
                {{ invitation.acceptedAt ? dialogs.cloudAccepted : dialogs.cloudInvitationPending }}
              </div>
            </div>
            <span class="text-[10px] text-muted">{{
              invitation.permission === 'edit' ? dialogs.cloudCanEdit : dialogs.cloudCanView
            }}</span>
            <button
              type="button"
              class="text-muted hover:text-danger"
              :aria-label="dialogs.cloudRevokeInvitation"
              @click="removeInvitation(invitation)"
            >
              <icon-lucide-x class="size-3.5" />
            </button>
          </div>
        </div>
      </section>

      <section class="mt-4 border-t border-border pt-4">
        <h3 class="mb-2 text-xs font-medium text-surface">{{ dialogs.cloudGeneralAccess }}</h3>
        <div class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-hover">
          <span class="flex size-7 items-center justify-center rounded-full bg-hover text-muted"
            ><icon-lucide-link class="size-3.5"
          /></span>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] text-surface">
              {{ activeShare ? dialogs.cloudAnyoneWithLink : dialogs.cloudRestricted }}
            </div>
            <div class="text-[9px] text-muted">
              {{
                activeShare
                  ? activeShare.permission === 'edit'
                    ? dialogs.cloudCanEdit
                    : dialogs.cloudCanView
                  : dialogs.cloudOnlyMembersAndInvited
              }}
            </div>
          </div>
          <button
            type="button"
            :class="quietButton.base"
            :disabled="!canManage"
            @click="settingsOpen = true"
          >
            {{ dialogs.cloudShareSettings }}
          </button>
        </div>
        <p
          v-if="oneTimeLink"
          class="mt-2 rounded border border-border bg-canvas px-2 py-1.5 text-[10px] text-muted"
        >
          {{ dialogs.cloudOneTimeLink }}
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
        {{ dialogs.cloudDisableLink }}
      </button>
      <button
        v-if="activeShare"
        type="button"
        :class="secondaryButton.base"
        :disabled="!canManage || loading"
        @click="rotateLink"
      >
        {{ dialogs.cloudRegenerateLink }}
      </button>
      <button
        v-else
        type="button"
        :class="primaryButton.base"
        :disabled="!canManage || loading"
        @click="createLink"
      >
        {{ dialogs.cloudCreateAndCopyLink }}
      </button>
    </AppDialogFooter>
  </AppDialogRoot>

  <AppDialogRoot v-model:open="settingsOpen" size="sm" :aria-label="dialogs.cloudShareSettings">
    <AppDialogHeader :heading="dialogs.cloudShareSettings" :close-label="dialogs.close" />
    <AppDialogBody class="space-y-5">
      <section>
        <h3 class="mb-2 text-xs font-medium text-surface">{{ dialogs.cloudWhoHasAccess }}</h3>
        <div class="rounded border border-border bg-panel-field px-3 py-2 text-[11px] text-surface">
          {{ activeShare ? dialogs.cloudAnyoneWithLink : dialogs.cloudOnlyInvited }}
        </div>
      </section>
      <section>
        <h3 class="mb-2 text-xs font-medium text-surface">{{ dialogs.cloudWhatTheyCanDo }}</h3>
        <AppSelect
          v-model="linkPermission"
          :options="permissionOptions"
          :label="dialogs.cloudLinkPermission"
        />
      </section>
      <section>
        <h3 class="mb-2 text-xs font-medium text-surface">{{ dialogs.cloudLinkExpiration }}</h3>
        <AppSelect
          v-model="expiration"
          :options="expirationOptions"
          :label="dialogs.cloudLinkExpiration"
        />
      </section>
      <section class="border-t border-border pt-4">
        <h3 class="text-xs font-medium text-surface">{{ dialogs.cloudAdvanced }}</h3>
        <p class="mt-1 text-[10px] leading-relaxed text-muted">
          {{ dialogs.cloudRelayDescription }}
        </p>
      </section>
    </AppDialogBody>
    <AppDialogFooter>
      <button type="button" :class="quietButton.base" @click="settingsOpen = false">
        {{ dialogs.cancel }}
      </button>
      <button type="button" :class="primaryButton.base" @click="saveSettings">
        {{ dialogs.cloudSave }}
      </button>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
