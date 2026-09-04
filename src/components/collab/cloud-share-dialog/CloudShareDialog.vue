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

import { useCloudMessages, useCommonMessages } from '@open-pencil/vue'

const open = defineModel<boolean>('open', { default: false })
const store = useEditorStore()
const cloudMessages = useCloudMessages()
const common = useCommonMessages()
const permissionOptions = computed(() => [
  { label: cloudMessages.value.canView, value: permissionOptionValues[0] },
  { label: cloudMessages.value.canEdit, value: permissionOptionValues[1] }
])
const expirationOptions = computed(() => [
  { label: cloudMessages.value.never, value: expirationOptionValues[0] },
  { label: cloudMessages.value.oneDay, value: expirationOptionValues[1] },
  { label: cloudMessages.value.sevenDays, value: expirationOptionValues[2] },
  { label: cloudMessages.value.thirtyDays, value: expirationOptionValues[3] }
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
  <AppDialogRoot v-model:open="open" size="md" :aria-label="cloudMessages.shareDocumentAria">
    <AppDialogHeader
      :heading="cloudMessages.shareDocument({ name: store.state.documentName })"
      :close-label="common.close"
    />
    <AppDialogBody>
      <div class="flex gap-2">
        <AppInput
          v-model="inviteEmail"
          class="min-w-0 flex-1"
          type="text"
          :placeholder="cloudMessages.emailAddress"
          :aria-label="cloudMessages.emailAddress"
          :disabled="!canManage || loading"
          @enter="invite"
        />
        <AppSelect
          v-model="invitePermission"
          class="w-24"
          :options="permissionOptions"
          :label="cloudMessages.invitationPermission"
          :disabled="!canManage || loading"
        />
        <button
          type="button"
          :class="primaryButton.base"
          :disabled="!inviteEmail.trim() || !canManage || loading"
          @click="invite"
        >
          {{ cloudMessages.invite }}
        </button>
      </div>

      <section class="mt-5">
        <h3 class="mb-2 text-xs font-medium text-surface">{{ cloudMessages.whoHasAccess }}</h3>
        <div class="space-y-1">
          <div class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-hover">
            <span
              class="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent"
            >
              <icon-lucide-building-2 class="size-3.5" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[11px] text-surface">
                {{ cloudMessages.workspaceMembers }}
              </div>
              <div class="text-[9px] text-muted">{{ cloudMessages.inheritedAccess }}</div>
            </div>
            <span class="text-[10px] text-muted">{{
              access?.permission === 'edit' ? cloudMessages.canEdit : cloudMessages.canView
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
              :label="cloudMessages.personPermission"
              :disabled="!canManage"
              @update:model-value="changeGrant(grant, $event as DocumentPermission)"
            />
            <button
              type="button"
              class="text-muted hover:text-danger"
              :aria-label="cloudMessages.removeAccess"
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
                {{
                  invitation.acceptedAt ? cloudMessages.accepted : cloudMessages.invitationPending
                }}
              </div>
            </div>
            <span class="text-[10px] text-muted">{{
              invitation.permission === 'edit' ? cloudMessages.canEdit : cloudMessages.canView
            }}</span>
            <button
              type="button"
              class="text-muted hover:text-danger"
              :aria-label="cloudMessages.revokeInvitation"
              @click="removeInvitation(invitation)"
            >
              <icon-lucide-x class="size-3.5" />
            </button>
          </div>
        </div>
      </section>

      <section class="mt-4 border-t border-border pt-4">
        <h3 class="mb-2 text-xs font-medium text-surface">{{ cloudMessages.generalAccess }}</h3>
        <div class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-hover">
          <span class="flex size-7 items-center justify-center rounded-full bg-hover text-muted"
            ><icon-lucide-link class="size-3.5"
          /></span>
          <div class="min-w-0 flex-1">
            <div class="text-[11px] text-surface">
              {{ activeShare ? cloudMessages.anyoneWithLink : cloudMessages.restricted }}
            </div>
            <div class="text-[9px] text-muted">
              {{
                activeShare
                  ? activeShare.permission === 'edit'
                    ? cloudMessages.canEdit
                    : cloudMessages.canView
                  : cloudMessages.onlyMembersAndInvited
              }}
            </div>
          </div>
          <button
            type="button"
            :class="quietButton.base"
            :disabled="!canManage"
            @click="settingsOpen = true"
          >
            {{ cloudMessages.shareSettings }}
          </button>
        </div>
        <p
          v-if="oneTimeLink"
          class="mt-2 rounded border border-border bg-canvas px-2 py-1.5 text-[10px] text-muted"
        >
          {{ cloudMessages.oneTimeLink }}
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
        {{ cloudMessages.disableLink }}
      </button>
      <button
        v-if="activeShare"
        type="button"
        :class="secondaryButton.base"
        :disabled="!canManage || loading"
        @click="rotateLink"
      >
        {{ cloudMessages.regenerateLink }}
      </button>
      <button
        v-else
        type="button"
        :class="primaryButton.base"
        :disabled="!canManage || loading"
        @click="createLink"
      >
        {{ cloudMessages.createAndCopyLink }}
      </button>
    </AppDialogFooter>
  </AppDialogRoot>

  <AppDialogRoot v-model:open="settingsOpen" size="sm" :aria-label="cloudMessages.shareSettings">
    <AppDialogHeader :heading="cloudMessages.shareSettings" :close-label="common.close" />
    <AppDialogBody class="space-y-5">
      <section>
        <h3 class="mb-2 text-xs font-medium text-surface">{{ cloudMessages.whoHasAccess }}</h3>
        <div class="rounded border border-border bg-panel-field px-3 py-2 text-[11px] text-surface">
          {{ activeShare ? cloudMessages.anyoneWithLink : cloudMessages.onlyInvited }}
        </div>
      </section>
      <section>
        <h3 class="mb-2 text-xs font-medium text-surface">{{ cloudMessages.whatTheyCanDo }}</h3>
        <AppSelect
          v-model="linkPermission"
          :options="permissionOptions"
          :label="cloudMessages.linkPermission"
        />
      </section>
      <section>
        <h3 class="mb-2 text-xs font-medium text-surface">{{ cloudMessages.linkExpiration }}</h3>
        <AppSelect
          v-model="expiration"
          :options="expirationOptions"
          :label="cloudMessages.linkExpiration"
        />
      </section>
      <section class="border-t border-border pt-4">
        <h3 class="text-xs font-medium text-surface">{{ cloudMessages.advanced }}</h3>
        <p class="mt-1 text-[10px] leading-relaxed text-muted">
          {{ cloudMessages.relayDescription }}
        </p>
      </section>
    </AppDialogBody>
    <AppDialogFooter>
      <button type="button" :class="quietButton.base" @click="settingsOpen = false">
        {{ common.cancel }}
      </button>
      <button type="button" :class="primaryButton.base" @click="saveSettings">
        {{ cloudMessages.save }}
      </button>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
