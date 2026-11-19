<script setup lang="ts">
import { createColumnHelper } from '@tanstack/vue-table'
import { compact } from 'es-toolkit'
import { computed, h, onDeactivated, ref } from 'vue'
import IconLayers from '~icons/lucide/layers'

import type { WorkspaceRole } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortalRows, type PortalTableFeatures } from '@/app/cloud-portal/list'
import { usePortalSignInMethodLabel } from '@/app/cloud-portal/methods'
import { portalTable } from '@/components/cloud-portal/table/ui'
import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'
import { useHeldContent } from '@/components/ui/overlay/held'
import AppDataTable from '@/components/ui/table/AppDataTable.vue'

import PortalSessions from '../account/PortalSessions.vue'
import { portalColumnMeta } from '../table/columns'
import PortalStatusCell from '../table/PortalStatusCell.vue'
import PortalTextCell from '../table/PortalTextCell.vue'
import type { PortalPersonAction, PortalPersonDetail } from '../types'
import PortalPersonActions from './PortalPersonActions.vue'

/**
 * One account as an administrator reads it: its standing, how it signs in, the workspaces it is
 * in, where it is signed in, and what the administrator can do about it.
 */
const { detail, busy = false } = defineProps<{ detail: PortalPersonDetail; busy?: boolean }>()
const emit = defineEmits<{
  act: [action: PortalPersonAction, reason?: string]
  removeMethod: [methodId: string]
  back: []
}>()

const ui = portalTable()
const messages = useCloudPortalMessages()
const person = computed(() => detail.person)

const methodLabel = usePortalSignInMethodLabel()
const removing = ref<PortalPersonDetail['methods'][number] | null>(null)
const removingShown = useHeldContent(removing)
// The console keeps a page it leaves; a confirmation must not outlive the visit that opened it.
onDeactivated(() => {
  removing.value = null
})

function removeMethod() {
  const method = removing.value
  removing.value = null
  if (method) emit('removeMethod', method.id)
}
const twoStep = computed(() => {
  const words = messages.value
  const parts = compact([
    detail.authenticator ? words.authenticatorApp : null,
    detail.passkeyCount ? words.passkeyCount(detail.passkeyCount) : null
  ])
  return parts.length ? parts.join(' · ') : words.twoStepNone
})
const roleLabel = (role: WorkspaceRole) =>
  ({
    admin: messages.value.workspaceRoleAdmin,
    editor: messages.value.workspaceRoleEditor,
    viewer: messages.value.workspaceRoleViewer
  })[role]

const column = createColumnHelper<PortalTableFeatures, PortalPersonDetail['workspaces'][number]>()
const workspaces = usePortalRows(() => detail.workspaces, {
  rowId: (workspace) => workspace.id,
  columns: column.columns([
    column.display({
      id: 'workspace',
      header: () => messages.value.columnWorkspace,
      cell: ({ row: { original: workspace } }) =>
        h(PortalTextCell, { icon: IconLayers, text: workspace.name, strong: true })
    }),
    column.display({
      id: 'role',
      header: () => messages.value.columnRole,
      meta: { role: 'tag', always: true },
      cell: ({ row: { original: workspace } }) =>
        h(PortalStatusCell, { statuses: [{ label: roleLabel(workspace.role), tone: 'neutral' }] })
    }),
    column.accessor('memberCount', {
      header: () => messages.value.columnMembers,
      meta: { role: 'count', always: true }
    })
  ])
})
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-6">
    <AppButton class="self-start" size="sm" variant="ghost" @click="emit('back')">
      <template #leading
        ><icon-lucide-arrow-left data-direction="reading" class="size-3.5"
      /></template>
      {{ messages.backToPeople }}
    </AppButton>

    <div class="flex items-center gap-3">
      <AccountAvatar :id="person.id" :name="person.name" :image="person.image" size="lg" />
      <div class="min-w-0 flex-1">
        <p class="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-surface">
          <span class="truncate">{{ person.name }}</span>
          <span v-if="person.you" class="shrink-0 font-normal text-muted">{{ messages.you }}</span>
          <span v-if="person.admin" :class="ui.status()" data-tone="neutral">
            {{ messages.administrator }}
          </span>
          <span v-if="person.suspended" :class="ui.status()" data-tone="error">
            {{ messages.suspended }}
          </span>
        </p>
        <p class="truncate text-xs text-muted">{{ person.email }}</p>
        <p v-if="person.suspendedReason" class="mt-0.5 text-2xs text-muted">
          {{ messages.suspendedReason({ reason: person.suspendedReason }) }}
        </p>
      </div>
      <PortalPersonActions
        look="button"
        :person="person"
        :disabled="busy"
        @act="(action, reason) => emit('act', action, reason)"
      />
    </div>

    <SettingsSection>
      <template #title>{{ messages.personAccount }}</template>
      <SettingsGroup>
        <SettingsRow
          :label="messages.email"
          :description="
            compact([
              person.email,
              detail.emailVerified ? messages.emailVerified : messages.emailNotVerified
            ]).join(' · ')
          "
        />
        <SettingsRow :label="messages.joinedRow" :description="person.joinedOn" />
        <SettingsRow
          :label="messages.lastActiveRow"
          :description="person.lastActive ?? messages.notSignedIn"
        />
        <SettingsRow :label="messages.twoStepRow" :description="twoStep" />
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection>
      <template #title>{{ messages.signInMethods }}</template>
      <SettingsGroup>
        <SettingsRow
          v-for="method in detail.methods"
          :key="method.id"
          :label="methodLabel(method.provider)"
          :description="messages.linkedOn({ date: method.linkedOn })"
        >
          <!-- Administrators change their own ways in on their security page. -->
          <AppButton
            v-if="method.canRemove && !person.you"
            size="sm"
            variant="outline"
            :disabled="busy"
            @click="removing = method"
          >
            {{ messages.removeSignInMethod }}
          </AppButton>
        </SettingsRow>
        <SettingsRow v-if="!detail.methods.length" :description="messages.twoStepNone" />
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection>
      <template #title>{{ messages.personWorkspaces }}</template>
      <AppDataTable
        :table="workspaces"
        :column-meta="portalColumnMeta"
        :label="messages.personWorkspaces"
      >
        <template #empty>
          <p class="text-center text-xs text-muted">{{ messages.personWorkspacesEmpty }}</p>
        </template>
      </AppDataTable>
    </SettingsSection>

    <PortalSessions :sessions="detail.sessions" :sign-ins="detail.signIns" />

    <AppConfirmationDialog
      :open="removing !== null"
      tone="danger"
      :heading="
        removingShown
          ? messages.removeSignInMethodHeading({
              provider: methodLabel(removingShown.provider),
              name: person.name
            })
          : ''
      "
      :description="messages.removeSignInMethodDescription"
      :confirm-label="messages.removeSignInMethod"
      @update:open="(open) => !open && (removing = null)"
      @confirm="removeMethod"
    />
  </div>
</template>
