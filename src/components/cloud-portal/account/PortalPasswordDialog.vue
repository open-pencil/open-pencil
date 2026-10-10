<script setup lang="ts">
import { ref, watch } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { portalForm } from '@/theme/cloud-portal/form'

/**
 * Asks for passwords: the current one to confirm a sensitive change, and a new one when the
 * change is the password itself.
 */
const {
  purpose,
  minimumPasswordLength = 15,
  error = null,
  saving = false
} = defineProps<{
  purpose: 'confirm' | 'change'
  minimumPasswordLength?: number
  error?: string | null
  saving?: boolean
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [passwords: { current: string; next: string }] }>()

const ui = portalForm()
const messages = useCloudPortalMessages()
const current = ref('')
const next = ref('')
watch(open, (value) => {
  if (!value) {
    current.value = ''
    next.value = ''
  }
})
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader
      :heading="purpose === 'change' ? messages.changePasswordTitle : messages.confirmPasswordTitle"
      :close-label="messages.cancel"
    />
    <form novalidate @submit.prevent="emit('submit', { current, next })">
      <AppDialogBody :ui="{ body: 'flex flex-col gap-3' }">
        <AppAlert v-if="error" tone="error" :heading="messages.signInFailed" :description="error" />
        <div :class="ui.field()">
          <label for="portal-current-password" :class="ui.label()">
            {{ messages.currentPassword }}
          </label>
          <AppInput
            id="portal-current-password"
            v-model="current"
            type="password"
            autocomplete="current-password"
          />
        </div>
        <div v-if="purpose === 'change'" :class="ui.field()">
          <label for="portal-next-password" :class="ui.label()">{{ messages.newPassword }}</label>
          <AppInput
            id="portal-next-password"
            v-model="next"
            type="password"
            autocomplete="new-password"
          />
          <p :class="ui.hint()">{{ messages.passwordHint({ count: minimumPasswordLength }) }}</p>
        </div>
      </AppDialogBody>
      <AppDialogFooter>
        <AppButton type="button" variant="ghost" @click="open = false">{{
          messages.cancel
        }}</AppButton>
        <AppButton type="submit" color="primary" variant="solid" :loading="saving">
          {{ purpose === 'change' ? messages.savePassword : messages.continue }}
        </AppButton>
      </AppDialogFooter>
    </form>
  </AppDialogRoot>
</template>
