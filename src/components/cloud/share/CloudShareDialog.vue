<script setup lang="ts">
import { computed, ref } from 'vue'

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
  workspace,
  members,
  link,
  canManage = true,
  inviting = false,
  copied = false
} = defineProps<{
  documentName: string
  workspace: { name: string; memberCount: number; permission: SharePermission }
  members: ShareMember[]
  link: ShareLinkState
  canManage?: boolean
  inviting?: boolean
  copied?: boolean
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
const email = ref('')
const invitePermission = ref<SharePermission>('edit')
const permissionOptions = [
  { value: 'edit' as const, label: 'Can edit' },
  { value: 'view' as const, label: 'Can view' }
]
const memberOptions = [...permissionOptions, { value: 'remove' as const, label: 'Remove access' }]
const accessValue = computed(() => link.access)
const linkPermission = computed<SharePermission>(() =>
  link.access === 'link' ? link.permission : 'view'
)
const PERMISSION_LABELS: Record<SharePermission | 'owner', string> = {
  owner: 'Owner',
  edit: 'Can edit',
  view: 'Can view'
}
const permissionLabel = (permission: SharePermission | 'owner') => PERMISSION_LABELS[permission]

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
      :heading="`Share “${documentName}”`"
      :description="`In ${workspace.name} on OpenPencil Cloud`"
      close-label="Close"
    />
    <AppDialogBody :ui="{ body: 'flex flex-col gap-5' }">
      <form v-if="canManage" :class="ui.invite()" @submit.prevent="submitInvite">
        <AppInput
          v-model="email"
          type="text"
          inputmode="email"
          autocomplete="email"
          placeholder="Add people by email"
          aria-label="Email address"
          density="compact"
          class="min-w-0 flex-1"
        >
          <template #leading><icon-lucide-user-plus class="size-3.5" /></template>
        </AppInput>
        <AppSelect
          v-model="invitePermission"
          label="Permission for new people"
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
          Invite
        </AppButton>
      </form>

      <section aria-labelledby="share-people-heading">
        <h3 id="share-people-heading" :class="ui.heading()">People with access</h3>
        <ul :class="ui.list()">
          <li v-for="member in members" :key="member.id" :class="ui.row()">
            <span v-if="member.pendingUntil" :class="ui.pendingAvatar()">
              <icon-lucide-mail class="size-3" />
            </span>
            <AccountAvatar v-else :id="member.id" :name="member.name" size="md" />
            <span :class="ui.rowBody()">
              <span :class="ui.rowName()">
                {{ member.pendingUntil ? member.email : member.name }}
                <span v-if="member.you" class="text-muted">(you)</span>
                <AppBadge v-if="member.pendingUntil">Invited</AppBadge>
              </span>
              <span :class="ui.rowDetail()">
                {{
                  member.pendingUntil ? `Invitation expires ${member.pendingUntil}` : member.email
                }}
              </span>
            </span>
            <span v-if="member.permission === 'owner' || !canManage" :class="ui.rowRole()">
              {{ permissionLabel(member.permission) }}
            </span>
            <AppSelect
              v-else
              :model-value="member.permission"
              :label="`Access for ${member.name}`"
              :options="memberOptions"
              :ui="{ trigger: 'w-28' }"
              @update:model-value="emit('changeMember', member.id, $event)"
            />
          </li>
          <li :class="ui.row()">
            <span :class="ui.groupAvatar()"><icon-lucide-layers class="size-3.5" /></span>
            <span :class="ui.rowBody()">
              <span :class="ui.rowName()">Everyone in {{ workspace.name }}</span>
              <span :class="ui.rowDetail()">{{ workspace.memberCount }} members</span>
            </span>
            <Tip label="Set by the workspace; change it in the workspace's settings">
              <span :class="ui.rowRole()">{{ permissionLabel(workspace.permission) }}</span>
            </Tip>
          </li>
        </ul>
      </section>

      <section aria-labelledby="share-link-heading">
        <h3 id="share-link-heading" :class="ui.heading()">General access</h3>
        <div :class="ui.access()">
          <span :class="ui.accessIcon()" :data-access="link.access">
            <icon-lucide-globe v-if="link.access === 'link'" class="size-4" />
            <icon-lucide-lock v-else class="size-4" />
          </span>
          <div :class="ui.accessBody()">
            <AppSelect
              v-if="canManage"
              :model-value="accessValue"
              label="General access"
              :options="[
                { value: 'restricted', label: 'Only people with access' },
                { value: 'link', label: 'Anyone with the link' }
              ]"
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
              {{ link.access === 'link' ? 'Anyone with the link' : 'Only people with access' }}
            </p>
            <p :class="ui.accessDetail()">
              {{
                link.access === 'link'
                  ? 'Anyone who has the link can open this file without signing in.'
                  : 'Only the people and workspace above can open this file.'
              }}
            </p>
          </div>
          <AppSelect
            v-if="link.access === 'link' && canManage"
            :model-value="link.permission"
            label="Link permission"
            :options="permissionOptions"
            :ui="{ trigger: 'w-28' }"
            @update:model-value="emit('changeLink', { ...link, permission: $event })"
          />
        </div>
      </section>
    </AppDialogBody>

    <AppDialogFooter :ui="{ footer: 'justify-between' }">
      <p v-if="!canManage" :class="ui.footnote()">
        Only the owner and editors can change who has access.
      </p>
      <template v-else-if="link.access === 'link' && !link.copyable">
        <Tip
          label="This link was made on another device. Resetting it makes a new link and the old one stops working."
        >
          <AppButton variant="outline" @click="emit('resetLink')">
            <template #leading><icon-lucide-refresh-cw class="size-3.5" /></template>
            Reset link
          </AppButton>
        </Tip>
      </template>
      <AppButton v-else-if="link.access === 'link'" variant="outline" @click="emit('copyLink')">
        <template #leading>
          <icon-lucide-check v-if="copied" class="size-3.5" />
          <icon-lucide-link v-else class="size-3.5" />
        </template>
        {{ copied ? 'Link copied' : 'Copy link' }}
      </AppButton>
      <span v-else />
      <AppButton color="primary" variant="solid" @click="open = false">Done</AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
