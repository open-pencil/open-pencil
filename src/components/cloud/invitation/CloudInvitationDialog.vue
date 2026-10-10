<script setup lang="ts">
import { computed } from 'vue'

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
  account = null
} = defineProps<{
  state: CloudInvitationState
  invitation?: CloudInvitationSummary | null
  /** The account signed in to the invitation's server, if any. */
  account?: { email: string } | null
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ accept: []; signIn: []; switchAccount: []; cancel: [] }>()

const ui = cloudInvitation()
const heading = computed(() => {
  if (state === 'unavailable') return 'This invitation can’t be used'
  if (!invitation) return 'Opening invitation'
  return `${invitation.inviterName} invited you`
})
const description = computed(() => {
  if (!invitation || state === 'unavailable') return undefined
  return invitation.permission === 'edit'
    ? `To edit a document on ${invitation.host}.`
    : `To view a document on ${invitation.host}.`
})
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader :heading="heading" :description="description" close-label="Close" />

    <AppDialogBody v-if="state === 'loading'">
      <p :class="ui.loading()" role="status">
        <icon-lucide-loader-circle :class="ui.spinner()" aria-hidden="true" />
        Checking the invitation…
      </p>
    </AppDialogBody>

    <AppDialogBody v-else-if="state === 'unavailable'">
      <div :class="ui.unavailable()">
        <span :class="ui.unavailableIcon()"><icon-lucide-mail-x class="size-4" /></span>
        <p :class="ui.unavailableDescription()">
          It expired, was withdrawn, or was already accepted. Ask
          {{ invitation?.inviterName ?? 'the person who sent it' }} for a new one.
        </p>
      </div>
    </AppDialogBody>

    <AppDialogBody v-else-if="invitation">
      <div :class="ui.stack()">
        <div :class="ui.document()">
          <span :class="ui.documentIcon()"><icon-lucide-file class="size-4" /></span>
          <span :class="ui.documentBody()">
            <span :class="ui.documentName()">{{ invitation.documentName }}</span>
            <span :class="ui.documentMeta()">Sent to {{ invitation.recipientHint }}</span>
            <span :class="ui.documentMeta()">Expires in {{ invitation.expiresIn }}</span>
          </span>
          <span :class="ui.permission()">
            {{ invitation.permission === 'edit' ? 'Can edit' : 'Can view' }}
          </span>
        </div>

        <AppAlert
          v-if="state === 'sign-in' && invitation.unknownServer"
          tone="warning"
          :heading="`You haven’t used ${invitation.host} before`"
          description="Only sign in if you trust this server. It stores the document and sees your edits."
        />
        <AppAlert
          v-else-if="state === 'sign-in'"
          tone="info"
          :heading="`Sign in to ${invitation.host}`"
          description="Use the account this invitation was sent to. The document opens right after."
        />
        <AppAlert
          v-else-if="state === 'wrong-account' && account"
          tone="warning"
          heading="This invitation is for another account"
          :description="`You’re signed in as ${account.email}. Sign in with ${invitation.recipientHint} to open it.`"
        />
      </div>
    </AppDialogBody>

    <AppDialogFooter>
      <template v-if="state === 'unavailable'">
        <AppButton variant="outline" @click="emit('cancel')">Close</AppButton>
      </template>
      <template v-else>
        <AppButton variant="ghost" @click="emit('cancel')">Not now</AppButton>
        <AppButton
          v-if="state === 'sign-in'"
          color="primary"
          variant="solid"
          @click="emit('signIn')"
        >
          Sign in to open
        </AppButton>
        <AppButton
          v-else-if="state === 'wrong-account'"
          color="primary"
          variant="solid"
          @click="emit('switchAccount')"
        >
          Use another account
        </AppButton>
        <AppButton
          v-else
          color="primary"
          variant="solid"
          :disabled="state === 'loading'"
          :loading="state === 'accepting'"
          @click="emit('accept')"
        >
          Open document
        </AppButton>
      </template>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
