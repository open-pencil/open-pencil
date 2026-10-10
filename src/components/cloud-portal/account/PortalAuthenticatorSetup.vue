<script setup lang="ts">
import { toDataURL } from 'qrcode'
import { ref, watchEffect } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppCopyField from '@/components/ui/input/AppCopyField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { portalForm } from '@/theme/cloud-portal/form'

/** Pairing an authenticator app: scan the code or type the key, then prove it works. */
const {
  uri,
  error = null,
  verifying = false
} = defineProps<{ uri: string; error?: string | null; verifying?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ verify: [code: string] }>()

const ui = portalForm()
const messages = useCloudPortalMessages()
const code = ref('')
const image = ref<string | null>(null)
const secret = ref('')

watchEffect(async () => {
  const parsed = URL.canParse(uri) ? new URL(uri) : null
  secret.value = parsed?.searchParams.get('secret') ?? ''
  image.value = await toDataURL(uri, { margin: 1, width: 176 })
})
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader
      :heading="messages.authenticatorSetupTitle"
      :description="messages.authenticatorSetupScan"
      :close-label="messages.cancel"
    />
    <AppDialogBody :ui="{ body: 'flex flex-col items-center gap-4' }">
      <img v-if="image" :src="image" alt="" class="size-44 rounded-lg bg-white p-2" />
      <div class="flex w-full flex-col gap-1.5">
        <span :class="ui.label()">{{ messages.authenticatorSetupKey }}</span>
        <AppCopyField
          :value="secret"
          :copy-label="messages.copyKey"
          :copied-label="messages.copied"
          look="command"
        />
      </div>
      <AppAlert v-if="error" tone="error" :heading="error" />
      <form class="flex w-full flex-col gap-3" novalidate @submit.prevent="emit('verify', code)">
        <AppInput
          v-model="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          :aria-label="messages.authenticationCode"
          placeholder="000000"
          :ui="{ input: ui.code() }"
        />
        <AppButton
          type="submit"
          color="primary"
          variant="solid"
          :loading="verifying"
          :ui="{ base: ui.submit() }"
        >
          {{ messages.continue }}
        </AppButton>
      </form>
    </AppDialogBody>
  </AppDialogRoot>
</template>
