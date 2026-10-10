<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCloudMessages, useCommonMessages } from '@open-pencil/vue'

import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppBadge from '@/components/ui/feedback/AppBadge.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { cloudShare } from '@/theme/cloud/share'

import type { SharePermission, ShareMember, ShareLinkState } from './types'

/**
 * Who can open a Cloud document and how: people invited by email, the workspace it lives in, and
 * whether anyone with the link may open it. Links are kept only as a hash on the server, so a
 * link made on another device has to be reset before it can be copied here.
 */
const {
  documentName,
  workspace = null,
  members,
  link,
  canManage = true,
  inviting = false,
  copied = false,
  links = { allowed: true, edit: true }
} = defineProps<{
  documentName: string
  /** The workspace the document lives in, when this account belongs to it. */
  workspace?: { name: string; memberCount?: number; permission: SharePermission } | null
  members: ShareMember[]
  link: ShareLinkState
  canManage?: boolean
  inviting?: boolean
  copied?: boolean
  /** What the workspace's plan allows for links: any link at all, and links that can edit. */
  links?: { allowed: boolean; edit: boolean }
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  invite: [email: string, permission: SharePermission]
  changeMember: [id: string, permission: SharePermission | 'remove']
  changeLink: [state: ShareLinkState]
  copyLink: []
  resetLink: []
}>()

const ui = cloudShare()
const t = useCloudMessages()
const common = useCommonMessages()
const email = ref('')
const invitePermission = ref<SharePermission>('edit')
const permissionOptions = computed(() => [
  { value: 'edit' as const, label: t.value.canEdit },
  { value: 'view' as const, label: t.value.canView }
])
const memberOptions = computed(() => [
  ...permissionOptions.value,
  { value: 'remove' as const, label: t.value.shareRemoveAccess }
])
const accessOptions = computed(() => [
  { value: 'restricted', label: t.value.shareRestricted },
  { value: 'link', label: t.value.shareAnyoneWithLink }
])
const accessValue = computed(() => link.access)
const linkPermission = computed<SharePermission>(() =>
  link.access === 'link' ? link.permission : 'view'
)
const permissionLabel = (permission: SharePermission | 'owner') =>
  ({ owner: t.value.shareOwner, edit: t.value.canEdit, view: t.value.canView })[permission]

function submitInvite() {
  const value = email.value.trim()
  if (!value) return
  emit('invite', value, invitePermission.value)
  email.value = ''
}
</script>

<template>
  <AppDialogRoot v-model:open="open" size="md">
    <AppDialogHeader
      :heading="t.shareHeading({ name: documentName })"
      :description="
        workspace
          ? t.shareDescriptionInWorkspace({ workspace: workspace.name })
          : t.shareDescription
      "
      :close-label="common.close"
    />
    <AppDialogBody :ui="{ body: 'flex flex-col gap-5' }">
      <form v-if="canManage" :class="ui.invite()" @submit.prevent="submitInvite">
        <AppInput
          v-model="email"
          type="text"
          inputmode="email"
          autocomplete="email"
          :placeholder="t.shareAddPeople"
          :aria-label="t.shareEmailAddress"
          density="compact"
          class="min-w-0 flex-1"
        >
          <template #leading><icon-lucide-user-plus class="size-3.5" /></template>
        </AppInput>
        <AppSelect
          v-model="invitePermission"
          :label="t.shareNewPeoplePermission"
          :options="permissionOptions"
          :ui="{ trigger: 'h-8 w-28' }"
        />
        <AppButton
          type="submit"
          color="primary"
          variant="solid"
          :loading="inviting"
          :ui="{ base: 'h-8 px-3' }"
        >
          {{ t.shareInvite }}
        </AppButton>
      </form>

      <section aria-labelledby="share-people-heading">
        <h3 id="share-people-heading" :class="ui.heading()">{{ t.sharePeopleWithAccess }}</h3>
        <ul :class="ui.list()">
          <li v-for="member in members" :key="member.id" :class="ui.row()">
            <span v-if="member.pendingUntil" :class="ui.pendingAvatar()">
              <icon-lucide-mail class="size-3" />
            </span>
            <AccountAvatar v-else :id="member.id" :name="member.name" size="md" />
            <span :class="ui.rowBody()">
              <span :class="ui.rowName()">
                {{ member.pendingUntil ? member.email : member.name }}
                <span v-if="member.you" class="text-muted">{{ t.shareYou }}</span>
                <AppBadge v-if="member.pendingUntil">{{ t.shareInvited }}</AppBadge>
              </span>
              <span :class="ui.rowDetail()">
                {{
                  member.pendingUntil
                    ? t.shareInvitationExpires({ date: member.pendingUntil })
                    : member.email
                }}
              </span>
            </span>
            <span v-if="member.permission === 'owner' || !canManage" :class="ui.rowRole()">
              {{ permissionLabel(member.permission) }}
            </span>
            <AppSelect
              v-else
              :model-value="member.permission"
              :label="t.shareAccessFor({ name: member.name })"
              :options="memberOptions"
              :ui="{ trigger: 'w-28' }"
              @update:model-value="emit('changeMember', member.id, $event)"
            />
          </li>
          <li v-if="workspace" :class="ui.row()">
            <span :class="ui.groupAvatar()"><icon-lucide-layers class="size-3.5" /></span>
            <span :class="ui.rowBody()">
              <span :class="ui.rowName()">{{
                t.shareEveryoneIn({ workspace: workspace.name })
              }}</span>
              <span v-if="workspace.memberCount" :class="ui.rowDetail()">
                {{ t.shareMemberCount(workspace.memberCount) }}
              </span>
            </span>
            <Tip :label="t.shareWorkspacePermissionTip">
              <span :class="ui.rowRole()">{{ permissionLabel(workspace.permission) }}</span>
            </Tip>
          </li>
        </ul>
      </section>

      <section aria-labelledby="share-link-heading">
        <h3 id="share-link-heading" :class="ui.heading()">{{ t.shareGeneralAccess }}</h3>
        <div :class="ui.access()">
          <span :class="ui.accessIcon()" :data-access="link.access">
            <icon-lucide-globe v-if="link.access === 'link'" class="size-4" />
            <icon-lucide-lock v-else class="size-4" />
          </span>
          <div :class="ui.accessBody()">
            <AppSelect
              v-if="canManage && (links.allowed || link.access === 'link')"
              :model-value="accessValue"
              :label="t.shareGeneralAccess"
              :options="accessOptions"
              :ui="{
                trigger: 'h-6 w-auto border-transparent bg-transparent px-1 -ml-1 font-medium'
              }"
              @update:model-value="
                emit(
                  'changeLink',
                  $event === 'link'
                    ? { access: 'link', permission: linkPermission, copyable: true }
                    : { access: 'restricted' }
                )
              "
            />
            <p v-else :class="ui.accessLabel()">
              {{ link.access === 'link' ? t.shareAnyoneWithLink : t.shareRestricted }}
            </p>
            <p :class="ui.accessDetail()">
              {{
                link.access === 'link'
                  ? t.shareLinkDetail
                  : links.allowed
                    ? t.shareRestrictedDetail
                    : t.shareRestrictedNoLinksDetail
              }}
            </p>
          </div>
          <AppSelect
            v-if="link.access === 'link' && canManage"
            :model-value="link.permission"
            :label="t.shareLinkPermission"
            :options="
              links.edit
                ? permissionOptions
                : permissionOptions.filter((option) => option.value === 'view')
            "
            :ui="{ trigger: 'w-28' }"
            @update:model-value="emit('changeLink', { ...link, permission: $event })"
          />
        </div>
      </section>
    </AppDialogBody>

    <AppDialogFooter :ui="{ footer: 'justify-between' }">
      <p v-if="!canManage" :class="ui.footnote()">
        {{ t.shareCannotManage }}
      </p>
      <template v-else-if="link.access === 'link' && !link.copyable">
        <Tip :label="t.shareResetLinkTip">
          <AppButton variant="outline" @click="emit('resetLink')">
            <template #leading><icon-lucide-refresh-cw class="size-3.5" /></template>
            {{ t.shareResetLink }}
          </AppButton>
        </Tip>
      </template>
      <AppButton v-else-if="link.access === 'link'" variant="outline" @click="emit('copyLink')">
        <template #leading>
          <icon-lucide-check v-if="copied" class="size-3.5" />
          <icon-lucide-link v-else class="size-3.5" />
        </template>
        {{ copied ? t.shareLinkCopied : t.shareCopyLink }}
      </AppButton>
      <span v-else />
      <AppButton color="primary" variant="solid" @click="open = false">{{ common.done }}</AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
