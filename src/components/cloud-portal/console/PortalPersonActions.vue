<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import { menu } from '@/components/ui/menu/menu'
import { portalForm } from '@/theme/cloud-portal/form'

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
const menuUI = menu()
const form = portalForm()
const confirming = ref<PortalPersonAction | null>(null)
const reason = ref('')

const confirmation = computed(() => {
  const action = confirming.value
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
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger as-child>
      <IconButton
        v-if="look === 'icon'"
        :label="messages.actionsFor({ name: person.name })"
        :disabled="disabled || person.you"
      >
        <icon-lucide-ellipsis class="size-3.5" />
      </IconButton>
      <AppButton
        v-else
        size="sm"
        variant="outline"
        :aria-label="messages.actionsFor({ name: person.name })"
        :disabled="disabled || person.you"
      >
        <icon-lucide-ellipsis class="size-3.5" />
      </AppButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        side="bottom"
        align="end"
        :side-offset="4"
        :class="[menuUI.content(), 'w-56']"
      >
        <DropdownMenuItem
          :class="menuUI.item({ justify: 'start' })"
          @select="ask(person.admin ? 'remove-admin' : 'make-admin')"
        >
          {{ person.admin ? messages.removeAdministrator : messages.makeAdministrator }}
        </DropdownMenuItem>
        <DropdownMenuItem :class="menuUI.item({ justify: 'start' })" @select="ask('sign-out')">
          {{ messages.signOutEverywhere }}
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="person.twoStep"
          :class="menuUI.item({ justify: 'start' })"
          @select="ask('reset-two-step')"
        >
          {{ messages.resetTwoStep }}
        </DropdownMenuItem>
        <DropdownMenuSeparator :class="menuUI.separator()" />
        <DropdownMenuItem
          :class="menuUI.item({ justify: 'start' })"
          @select="ask(person.suspended ? 'restore' : 'suspend')"
        >
          {{ person.suspended ? messages.restoreAccount : messages.suspendAccount }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
  <AppConfirmationDialog
    :open="confirmation !== null"
    :tone="confirmation?.tone"
    :heading="confirmation?.heading ?? ''"
    :description="confirmation?.description"
    :cancel-label="messages.cancel"
    :confirm-label="confirmation?.confirm ?? ''"
    @update:open="(open) => !open && (confirming = null)"
    @confirm="confirm"
  >
    <div v-if="confirming === 'suspend'" :class="[form.field(), 'mt-3']">
      <label for="portal-suspend-reason" :class="form.label()">{{ messages.suspendReason }}</label>
      <AppTextarea id="portal-suspend-reason" v-model="reason" :rows="2" maxlength="500" />
    </div>
  </AppConfirmationDialog>
</template>
