<script setup lang="ts">
import { compact } from 'es-toolkit'
import { computed, ref } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { portalForm } from '@/components/cloud-portal/ui'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import { useHeldContent } from '@/components/ui/overlay/held'

import PortalRowMenu from '../table/PortalRowMenu.vue'
import type { PortalPerson, PortalPersonAction } from '../types'

/**
 * What an administrator can do to an account, in a menu, each asked once more before it happens;
 * suspending also takes a reason for the other administrators.
 */
const {
  person,
  look = 'icon',
  disabled = false
} = defineProps<{
  person: PortalPerson
  /** An icon in a list row, or a labelled button on the person's page. */
  look?: 'icon' | 'button'
  disabled?: boolean
}>()
const emit = defineEmits<{ act: [action: PortalPersonAction, reason?: string] }>()

const messages = useCloudPortalMessages()
const form = portalForm()
const confirming = ref<PortalPersonAction | null>(null)
const reason = ref('')

const confirmingShown = useHeldContent(confirming)
const confirmation = computed(() => {
  const action = confirmingShown.value
  if (!action) return null
  const words = messages.value
  const name = person.name
  const copy: Record<
    PortalPersonAction,
    { heading: string; description: string; confirm: string; tone: 'primary' | 'danger' }
  > = {
    'make-admin': {
      heading: words.makeAdministratorHeading({ name }),
      description: words.makeAdministratorDescription,
      confirm: words.makeAdministrator,
      tone: 'primary'
    },
    'remove-admin': {
      heading: words.removeAdministratorHeading({ name }),
      description: words.removeAdministratorDescription,
      confirm: words.removeAdministrator,
      tone: 'danger'
    },
    'sign-out': {
      heading: words.signOutEverywhereHeading({ name }),
      description: words.signOutEverywhereDescription,
      confirm: words.signOutEverywhere,
      tone: 'danger'
    },
    'reset-two-step': {
      heading: words.resetTwoStepHeading({ name }),
      description: words.resetTwoStepDescription,
      confirm: words.resetTwoStep,
      tone: 'danger'
    },
    'remove-picture': {
      heading: words.removePersonPictureHeading({ name }),
      description: words.removePersonPictureDescription,
      confirm: words.removePersonPicture,
      tone: 'danger'
    },
    suspend: {
      heading: words.suspendHeading({ name }),
      description: words.suspendDescription,
      confirm: words.suspendAccount,
      tone: 'danger'
    },
    restore: {
      heading: words.restoreHeading({ name }),
      description: words.restoreDescription,
      confirm: words.restoreAccount,
      tone: 'primary'
    }
  }
  return copy[action]
})

const items = computed(() => {
  const words = messages.value
  return compact([
    person.admin
      ? { action: 'remove-admin' as const, label: words.removeAdministrator }
      : { action: 'make-admin' as const, label: words.makeAdministrator },
    { action: 'sign-out' as const, label: words.signOutEverywhere },
    person.twoStep && { action: 'reset-two-step' as const, label: words.resetTwoStep },
    person.image && { action: 'remove-picture' as const, label: words.removePersonPicture },
    person.suspended
      ? { action: 'restore' as const, label: words.restoreAccount, separated: true }
      : { action: 'suspend' as const, label: words.suspendAccount, separated: true }
  ])
})

function ask(action: PortalPersonAction) {
  reason.value = ''
  confirming.value = action
}

function confirm() {
  const action = confirming.value
  confirming.value = null
  if (!action) return
  if (action === 'suspend') emit('act', action, reason.value.trim() || undefined)
  else emit('act', action)
}
</script>

<template>
  <PortalRowMenu
    :label="messages.actionsFor({ name: person.name })"
    :items="items"
    :look="look"
    :disabled="disabled || person.you"
    @select="ask"
  />
  <AppConfirmationDialog
    :open="confirming !== null"
    :tone="confirmation?.tone"
    :heading="confirmation?.heading ?? ''"
    :description="confirmation?.description"
    :cancel-label="messages.cancel"
    :confirm-label="confirmation?.confirm ?? ''"
    @update:open="(open) => !open && (confirming = null)"
    @confirm="confirm"
  >
    <div v-if="confirmingShown === 'suspend'" :class="[form.field(), 'mt-3']">
      <label for="portal-suspend-reason" :class="form.label()">{{ messages.suspendReason }}</label>
      <AppTextarea id="portal-suspend-reason" v-model="reason" :rows="2" maxlength="500" />
    </div>
  </AppConfirmationDialog>
</template>
