<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import { toDataURL } from 'qrcode'
import { computed, ref, watch } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { portalForm } from '@/components/cloud-portal/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppCopyField from '@/components/ui/input/AppCopyField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

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
watch(open, (value) => {
  if (value) code.value = ''
})
const secret = computed(() =>
  URL.canParse(uri) ? (new URL(uri).searchParams.get('secret') ?? '') : ''
)
// A newer key replaces a QR code still rendering for an older one; a failed render leaves the key.
const rendered = computedAsync(
  () =>
    toDataURL(uri, { margin: 1, width: 176 })
      .then((data) => ({ uri, data }))
      .catch(() => null),
  null
)
/** Only the current key's code, so a reopened dialog never shows the previous one. */
const image = computed(() => (rendered.value?.uri === uri ? rendered.value.data : null))
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader
      :heading="messages.authenticatorSetupTitle"
      :description="messages.authenticatorSetupScan"
      :close-label="messages.cancel"
    />
    <AppDialogBody :ui="{ body: 'flex flex-col items-center gap-4' }">
      <!-- The box keeps its size while the code renders, so the dialog does not jump. -->
      <div class="size-44 rounded-lg bg-white p-2">
        <img v-if="image" :src="image" alt="" class="size-full" />
      </div>
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
