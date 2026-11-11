<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  CLOUD_ACCESS_TOKEN_NAME_MAX_LENGTH,
  type CloudAccessTokenCreate
} from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppCopyButton from '@/components/ui/button/AppCopyButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogCancel from '@/components/ui/dialog/AppDialogCancel.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

/**
 * Making a personal access token: its name and how long it lasts, then the token itself, shown
 * this once. The dialog closes from the token only once it was copied.
 */
const {
  busy = false,
  error = null,
  created = null
} = defineProps<{
  busy?: boolean
  /** Why making the token failed. */
  error?: string | null
  /** The new token, once made. */
  created?: string | null
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [input: CloudAccessTokenCreate] }>()

const messages = useCloudPortalMessages()
// The section mounts the dialog afresh for each opening, so its fields start empty.
const name = ref('')
const days = ref('90')
const copied = ref(false)

/** The token can't be shown again, so Escape or a click outside leaves it until it is copied. */
function keepUncopied(event: Event) {
  if (!copied.value) event.preventDefault()
}

const expiries = computed(() => [
  { value: '30', label: messages.value.accessTokenExpires30Days },
  { value: '90', label: messages.value.accessTokenExpires90Days },
  { value: '365', label: messages.value.accessTokenExpiresYear }
])

function submit() {
  const trimmed = name.value.trim()
  if (!trimmed) return
  emit('submit', { name: trimmed, expiresInDays: Number(days.value) })
}
</script>

<template>
  <AppDialogRoot
    v-if="created"
    v-model:open="open"
    size="sm"
    @escape-key-down="keepUncopied"
    @pointer-down-outside="keepUncopied"
  >
    <AppDialogHeader
      :heading="messages.accessTokenCreatedTitle"
      :description="messages.accessTokenCreatedDescription"
      :show-close="false"
    />
    <AppDialogBody>
      <p
        class="rounded-lg bg-input px-4 py-3 font-mono text-xs break-all select-all"
        data-test-id="access-token-value"
      >
        {{ created }}
      </p>
    </AppDialogBody>
    <AppDialogFooter>
      <template #start>
        <AppCopyButton
          :value="created"
          :label="messages.copy"
          :copied-label="messages.copied"
          variant="outline"
          @copied="copied = true"
        />
      </template>
      <AppButton color="primary" variant="solid" :disabled="!copied" @click="open = false">
        {{ messages.done }}
      </AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
  <AppFormDialog
    v-else
    v-model:open="open"
    size="sm"
    :heading="messages.newAccessToken"
    :error="error"
    @submit="submit"
  >
    <AppFormField :label="messages.name" :hint="messages.accessTokenNameHint">
      <template #default="{ id, describedBy }">
        <AppInput
          :id="id"
          v-model="name"
          size="md"
          autofocus
          :maxlength="CLOUD_ACCESS_TOKEN_NAME_MAX_LENGTH"
          :aria-describedby="describedBy"
        />
      </template>
    </AppFormField>
    <AppFormField :label="messages.accessTokenExpiry">
      <SegmentedControl v-model="days" :options="expiries" :label="messages.accessTokenExpiry" />
    </AppFormField>
    <template #footer>
      <AppDialogCancel size="md" />
      <AppButton
        type="submit"
        size="md"
        color="primary"
        variant="solid"
        :loading="busy"
        :disabled="!name.trim()"
      >
        {{ messages.createAccessToken }}
      </AppButton>
    </template>
  </AppFormDialog>
</template>
