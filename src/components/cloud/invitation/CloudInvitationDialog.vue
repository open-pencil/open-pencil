<script setup lang="ts">
import { computed } from 'vue'

import { useCloudMessages, useCommonMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import { cloudInvitation } from '@/theme/cloud/invitation'

import type { CloudInvitationState, CloudInvitationSummary } from './types'

/**
 * Opening an invitation link: who invited you to which document and on which server, then the
 * one step left — accept it, sign in to that server first, or switch to the invited account.
 * A self-hosted server the editor has never used gets a warning before anyone signs in to it.
 */
const {
  state,
  invitation = null,
  account = null,
  offerDesktop = false
} = defineProps<{
  state: CloudInvitationState
  invitation?: CloudInvitationSummary | null
  /** The account signed in to the invitation's server, if any. */
  account?: { email: string } | null
  /** The web editor on a computer can hand the invitation to the desktop app. */
  offerDesktop?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  accept: []
  signIn: []
  switchAccount: []
  openInDesktop: []
  cancel: []
}>()

const ui = cloudInvitation()
const t = useCloudMessages()
const common = useCommonMessages()
const heading = computed(() => {
  if (state === 'unavailable') return t.value.invitationUnavailableHeading
  if (!invitation) return t.value.invitationOpening
  return t.value.invitedYou({ name: invitation.inviterName })
})
const description = computed(() => {
  if (!invitation || state === 'unavailable') return undefined
  return invitation.permission === 'edit'
    ? t.value.invitationEditDescription({ host: invitation.host })
    : t.value.invitationViewDescription({ host: invitation.host })
})
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader :heading="heading" :description="description" :close-label="common.close" />

    <AppDialogBody v-if="state === 'loading'">
      <p :class="ui.loading()" role="status">
        <icon-lucide-loader-circle :class="ui.spinner()" aria-hidden="true" />
        {{ t.invitationChecking }}
      </p>
    </AppDialogBody>

    <AppDialogBody v-else-if="state === 'unavailable'">
      <div :class="ui.unavailable()">
        <span :class="ui.unavailableIcon()"><icon-lucide-mail-x class="size-4" /></span>
        <p :class="ui.unavailableDescription()">
          {{
            invitation
              ? t.invitationUnavailableDescription({ name: invitation.inviterName })
              : t.invitationUnavailableDescriptionNoName
          }}
        </p>
      </div>
    </AppDialogBody>

    <AppDialogBody v-else-if="invitation">
      <div :class="ui.stack()">
        <div :class="ui.document()">
          <span :class="ui.documentIcon()"><icon-lucide-file class="size-4" /></span>
          <span :class="ui.documentBody()">
            <span :class="ui.documentName()">{{ invitation.documentName }}</span>
            <span :class="ui.documentMeta()">{{
              t.invitationSentTo({ recipient: invitation.recipientHint })
            }}</span>
            <span :class="ui.documentMeta()">{{
              t.invitationExpiresIn({ duration: invitation.expiresIn })
            }}</span>
          </span>
          <span :class="ui.permission()">
            {{ invitation.permission === 'edit' ? t.canEdit : t.canView }}
          </span>
        </div>

        <AppAlert
          v-if="state === 'sign-in' && invitation.unknownServer"
          tone="warning"
          :heading="t.unknownServerHeading({ host: invitation.host })"
          :description="t.unknownServerDescription"
        />
        <AppAlert
          v-else-if="state === 'sign-in'"
          tone="info"
          :heading="t.invitationSignInHeading({ host: invitation.host })"
          :description="t.invitationSignInDescription"
        />
        <AppAlert
          v-else-if="state === 'wrong-account' && account"
          tone="warning"
          :heading="t.wrongAccountHeading"
          :description="
            t.wrongAccountDescription({ email: account.email, recipient: invitation.recipientHint })
          "
        />
      </div>
    </AppDialogBody>

    <AppDialogFooter>
      <template v-if="state === 'unavailable'">
        <AppButton variant="outline" @click="emit('cancel')">{{ common.close }}</AppButton>
      </template>
      <template v-else>
        <AppButton
          v-if="offerDesktop"
          :class="ui.desktop()"
          variant="ghost"
          :disabled="state === 'accepting'"
          @click="emit('openInDesktop')"
        >
          <template #leading><icon-lucide-monitor class="size-3.5" /></template>
          {{ t.openInDesktopApp }}
        </AppButton>
        <AppButton variant="ghost" @click="emit('cancel')">{{ t.notNow }}</AppButton>
        <AppButton
          v-if="state === 'sign-in'"
          color="primary"
          variant="solid"
          @click="emit('signIn')"
        >
          {{ t.signInToOpen }}
        </AppButton>
        <AppButton
          v-else-if="state === 'wrong-account'"
          color="primary"
          variant="solid"
          @click="emit('switchAccount')"
        >
          {{ t.useAnotherAccount }}
        </AppButton>
        <AppButton
          v-else
          color="primary"
          variant="solid"
          :disabled="state === 'loading'"
          :loading="state === 'accepting'"
          @click="emit('accept')"
        >
          {{ t.openDocument }}
        </AppButton>
      </template>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
