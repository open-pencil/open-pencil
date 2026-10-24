<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { WorkspaceMembers, WorkspaceRole } from '@open-pencil/cloud/contract'
import { useCloudMessages, useCommonMessages } from '@open-pencil/vue/i18n'

import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { useHeldContent } from '@/components/ui/overlay/held'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { cloudWorkspace } from '@/theme/cloud/workspace'

/**
 * Who belongs to a Cloud workspace. Administrators rename it, invite people by email with a
 * role, change roles, and remove people; everyone sees the members and may leave. Leaving and
 * deleting sit apart in a danger zone, and deleting asks for the workspace's name.
 */
const {
  workspaceName,
  canManage = false,
  self = null,
  members = null,
  loading = false,
  busy = false,
  failure = null,
  invitationLink = null
} = defineProps<{
  workspaceName: string
  /** The person administers the workspace. */
  canManage?: boolean
  /** The person's own user id, so their row offers Leave rather than Remove. */
  self?: string | null
  members?: WorkspaceMembers | null
  loading?: boolean
  busy?: boolean
  /** Why the last change was refused, already worded. */
  failure?: string | null
  /** The link of the invitation just sent, for when the server sends no email. */
  invitationLink?: string | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  rename: [name: string]
  invite: [email: string, role: WorkspaceRole]
  revoke: [invitationId: string]
  changeRole: [userId: string, role: WorkspaceRole]
  remove: [userId: string]
  leave: []
  delete: []
}>()

const ui = cloudWorkspace()
const { copy, copied } = useClipboard({ copiedDuring: 1500 })
const t = useCloudMessages()
const common = useCommonMessages()
const name = ref(workspaceName)
const email = ref('')
const role = ref<WorkspaceRole>('editor')
watch(
  () => workspaceName,
  (next) => {
    name.value = next
  }
)
watch(open, (isOpen) => {
  if (isOpen) email.value = ''
})
const roleOptions = computed(() => [
  { value: 'admin' as const, label: t.value.roleAdmin },
  { value: 'editor' as const, label: t.value.roleEditor },
  { value: 'viewer' as const, label: t.value.roleViewer }
])
/** As in the Share dialog, removing someone is the last choice of their role menu. */
const memberOptions = computed(() => [
  ...roleOptions.value,
  { value: 'remove' as const, label: t.value.shareRemoveAccess }
])
function changeMember(userId: string, name: string, next: WorkspaceRole | 'remove') {
  if (next === 'remove') confirming.value = { kind: 'remove', userId, name }
  else emit('changeRole', userId, next)
}
const roleLabels = computed<Record<WorkspaceRole, string>>(() => ({
  admin: t.value.roleAdmin,
  editor: t.value.roleEditor,
  viewer: t.value.roleViewer
}))
const renamed = computed(() => name.value.trim() && name.value.trim() !== workspaceName)

/** Leaving or removing someone takes away access, so it is asked once more. */
const confirming = ref<
  { kind: 'leave' } | { kind: 'delete' } | { kind: 'remove'; userId: string; name: string } | null
>(null)
const confirmingShown = useHeldContent(confirming)
const confirmation = computed(() => {
  const pending = confirmingShown.value
  if (!pending) return null
  if (pending.kind === 'delete') {
    return {
      heading: t.value.deleteWorkspaceHeading({ workspace: workspaceName }),
      description: t.value.deleteWorkspaceDescription,
      confirm: t.value.deleteWorkspace
    }
  }
  return pending.kind === 'leave'
    ? {
        heading: t.value.leaveWorkspaceHeading({ workspace: workspaceName }),
        description: t.value.leaveWorkspaceDescription,
        confirm: t.value.leaveWorkspace
      }
    : {
        heading: t.value.removeMemberHeading({ name: pending.name, workspace: workspaceName }),
        description: t.value.removeMemberDescription,
        confirm: t.value.removeMemberConfirm
      }
})
/** Deleting can't be undone, so it waits for the workspace's name. */
const typedName = ref('')
watch(
  () => confirming.value !== null,
  (isOpen) => {
    if (isOpen) typedName.value = ''
  }
)
const confirmBlocked = computed(
  () => confirmingShown.value?.kind === 'delete' && typedName.value.trim() !== workspaceName.trim()
)
function confirm() {
  const pending = confirming.value
  if (confirmBlocked.value) return
  confirming.value = null
  if (pending?.kind === 'leave') emit('leave')
  else if (pending?.kind === 'delete') emit('delete')
  else if (pending) emit('remove', pending.userId)
}

function invite() {
  const address = email.value.trim()
  if (!address) return
  emit('invite', address, role.value)
  email.value = ''
}
</script>

<template>
  <AppDialogRoot v-model:open="open" size="md">
    <AppDialogHeader
      :heading="workspaceName"
      :description="t.membersDescription"
      :close-label="common.close"
    />
    <AppDialogBody>
      <div :class="ui.stack()">
        <form
          v-if="canManage"
          :class="ui.section()"
          novalidate
          @submit.prevent="renamed && emit('rename', name.trim())"
        >
          <label for="cloud-workspace-name" :class="ui.sectionTitle()">{{ t.workspaceName }}</label>
          <div :class="ui.inline()">
            <AppInput
              id="cloud-workspace-name"
              v-model="name"
              maxlength="100"
              :disabled="busy"
              :ui="{ root: 'flex-1' }"
            />
            <AppButton v-if="renamed" type="submit" variant="outline" :disabled="busy">
              {{ t.renameWorkspace }}
            </AppButton>
          </div>
        </form>

        <section v-if="canManage" :class="ui.section()">
          <h3 :class="ui.sectionTitle()">{{ t.invitePeople }}</h3>
          <form :class="ui.inline()" novalidate @submit.prevent="invite">
            <label for="cloud-workspace-invite" class="sr-only">{{ t.inviteEmail }}</label>
            <AppInput
              id="cloud-workspace-invite"
              v-model="email"
              type="email"
              autocomplete="off"
              :placeholder="t.inviteEmailPlaceholder"
              :disabled="busy"
              :ui="{ root: 'flex-1' }"
            />
            <AppSelect
              v-model="role"
              :label="t.inviteRole"
              :options="roleOptions"
              :ui="{ trigger: ui.roleSelect() }"
            />
            <AppButton type="submit" variant="outline" :disabled="busy || !email.trim()">
              {{ t.invite }}
            </AppButton>
          </form>
          <div v-if="invitationLink" :class="ui.sent()">
            <p :class="ui.note()">{{ t.invitationSentNote }}</p>
            <AppButton class="self-start" size="sm" variant="outline" @click="copy(invitationLink)">
              <template #leading>
                <icon-lucide-check v-if="copied" class="size-3.5" />
                <icon-lucide-link v-else class="size-3.5" />
              </template>
              {{ copied ? common.copied : t.copyInvitationLink }}
            </AppButton>
          </div>
        </section>

        <AppAlert v-if="failure" tone="error" :heading="failure" />

        <section :class="ui.section()">
          <!-- Counted once known; "0 members" while loading would be a wrong first frame. -->
          <h3 v-if="members" :class="ui.sectionTitle()">
            {{ t.shareMemberCount(members.members.length) }}
          </h3>
          <p v-if="loading" :class="ui.note()" role="status">{{ t.membersLoading }}</p>
          <ul v-else :class="ui.list()">
            <li v-for="member in members?.members ?? []" :key="member.userId" :class="ui.row()">
              <AccountAvatar :id="member.userId" :name="member.name" />
              <span :class="ui.person()">
                <span :class="ui.personName()">
                  {{ member.name }}
                  <span v-if="member.userId === self" :class="ui.you()">{{ common.you }}</span>
                </span>
                <span :class="ui.personEmail()">{{ member.email }}</span>
              </span>
              <AppSelect
                v-if="canManage"
                :model-value="member.role"
                :label="t.memberRole({ name: member.name })"
                :options="member.userId === self ? roleOptions : memberOptions"
                :disabled="busy"
                :ui="{ trigger: ui.roleSelect() }"
                @update:model-value="(next) => changeMember(member.userId, member.name, next)"
              />
              <span v-else :class="ui.role()">{{ roleLabels[member.role] }}</span>
            </li>
          </ul>
        </section>

        <section v-if="canManage && members?.invitations.length" :class="ui.section()">
          <h3 :class="ui.sectionTitle()">{{ t.pendingInvitations }}</h3>
          <ul :class="ui.list()">
            <li v-for="invitation in members.invitations" :key="invitation.id" :class="ui.row()">
              <span :class="ui.pendingIcon()"><icon-lucide-mail class="size-3.5" /></span>
              <span :class="ui.person()">
                <span :class="ui.personName()">{{ invitation.email }}</span>
              </span>
              <span :class="ui.role()">{{ roleLabels[invitation.role] }}</span>
              <AppButton
                size="xs"
                variant="link"
                :disabled="busy"
                @click="emit('revoke', invitation.id)"
              >
                {{ t.revokeInvitation }}
              </AppButton>
            </li>
          </ul>
        </section>

        <section :class="ui.section()" aria-labelledby="cloud-workspace-danger">
          <h3 id="cloud-workspace-danger" :class="ui.dangerTitle()">{{ t.dangerZone }}</h3>
          <ul :class="ui.dangerList()">
            <li :class="ui.dangerRow()">
              <span :class="ui.person()">
                <span :class="ui.personName()">{{ t.leaveWorkspace }}</span>
                <span :class="ui.dangerDescription()">{{ t.leaveWorkspaceDescription }}</span>
              </span>
              <AppButton
                color="error"
                variant="outline"
                :disabled="busy"
                @click="confirming = { kind: 'leave' }"
              >
                {{ t.leaveWorkspaceShort }}
              </AppButton>
            </li>
            <li v-if="canManage" :class="ui.dangerRow()">
              <span :class="ui.person()">
                <span :class="ui.personName()">{{ t.deleteWorkspace }}</span>
                <span :class="ui.dangerDescription()">{{ t.deleteWorkspaceDescription }}</span>
              </span>
              <AppButton
                color="error"
                variant="outline"
                :disabled="busy"
                @click="confirming = { kind: 'delete' }"
              >
                {{ t.deleteWorkspaceShort }}
              </AppButton>
            </li>
          </ul>
        </section>
      </div>
    </AppDialogBody>
    <AppDialogFooter>
      <AppButton color="primary" variant="solid" @click="open = false">
        {{ common.done }}
      </AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
  <AppConfirmationDialog
    :open="confirming !== null"
    tone="danger"
    :heading="confirmation?.heading ?? ''"
    :description="confirmation?.description"
    :cancel-label="common.cancel"
    :confirm-label="confirmation?.confirm ?? ''"
    :confirm-disabled="confirmBlocked"
    @update:open="(isOpen) => !isOpen && (confirming = null)"
    @confirm="confirm"
  >
    <div v-if="confirmingShown?.kind === 'delete'" :class="ui.confirmName()">
      <label for="cloud-workspace-delete-name" :class="ui.label()">
        {{ t.deleteWorkspaceTypeName({ workspace: workspaceName }) }}
      </label>
      <AppInput
        id="cloud-workspace-delete-name"
        v-model="typedName"
        autocomplete="off"
        spellcheck="false"
        @enter="confirm"
      />
    </div>
  </AppConfirmationDialog>
</template>
