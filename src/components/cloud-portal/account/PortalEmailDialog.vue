<script setup lang="ts">
import * as v from 'valibot'
import { computed, ref, watch } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { portalForm } from '@/theme/cloud-portal/form'

/** Asks for the address an account moves to; the server mails it a link to confirm. */
const {
  currentEmail,
  error = null,
  saving = false
} = defineProps<{ currentEmail: string; error?: string | null; saving?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [email: string] }>()

const ui = portalForm()
const messages = useCloudPortalMessages()
const email = ref('')
const invalid = ref<string | null>(null)
watch(open, (value) => {
  if (!value) {
    email.value = ''
    invalid.value = null
  }
})

const schema = computed(() =>
  v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(messages.value.errorEmailRequired),
    v.email(messages.value.errorEmailInvalid)
  )
)

function submit() {
  const result = v.safeParse(schema.value, email.value)
  if (!result.success) {
    invalid.value = result.issues[0].message
    return
  }
  invalid.value = null
  emit('submit', result.output)
}
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader
      :heading="messages.changeEmailTitle"
      :description="messages.changeEmailDescription({ email: currentEmail })"
      :close-label="messages.cancel"
    />
    <form novalidate @submit.prevent="submit">
      <AppDialogBody :ui="{ body: 'flex flex-col gap-3' }">
        <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
        <div :class="ui.field()">
          <label for="portal-new-email" :class="ui.label()">{{ messages.newEmail }}</label>
          <AppInput
            id="portal-new-email"
            v-model="email"
            type="email"
            autocomplete="email"
            autofocus
            :placeholder="messages.emailPlaceholder"
            :state="invalid ? 'invalid' : 'idle'"
          />
          <p v-if="invalid" :class="ui.error()">{{ invalid }}</p>
        </div>
      </AppDialogBody>
      <AppDialogFooter :ui="{ footer: 'justify-between' }">
        <AppButton type="button" @click="open = false">{{ messages.cancel }}</AppButton>
        <AppButton type="submit" color="primary" variant="solid" :loading="saving">
          {{ messages.sendConfirmation }}
        </AppButton>
      </AppDialogFooter>
    </form>
  </AppDialogRoot>
</template>
