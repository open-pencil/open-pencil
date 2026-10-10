<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { computed } from 'vue'

import { useCloudMessages, useCommonMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppCopyField from '@/components/ui/input/AppCopyField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppActionRow from '@/components/ui/list/AppActionRow.vue'
import { cloudConnect } from '@/theme/cloud/connect'

import type {
  CloudServerKind,
  CloudSignInMethod,
  CloudConnectStep,
  CloudConnectError
} from './types'

/**
 * Connecting the editor to an OpenPencil Cloud server and signing in: choose the hosted service
 * or a team's own server, check that it answers, then sign in with what the server offers. The
 * desktop app signs in through the browser with a one-time code.
 */
const {
  step,
  official,
  server = null,
  error = null,
  device = null,
  desktop = false
} = defineProps<{
  step: CloudConnectStep
  /** The hosted service's address, offered as the first choice. */
  official: string
  /** The server that answered, once checked. */
  server?: { host: string; methods: CloudSignInMethod[] } | null
  error?: CloudConnectError | null
  /** The code the desktop app asks the person to confirm in the browser. */
  device?: { code: string; expiresIn: string } | null
  desktop?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })
const kind = defineModel<CloudServerKind>('kind', { default: 'official' })
const address = defineModel<string>('address', { default: '' })
const emit = defineEmits<{
  continue: []
  changeServer: []
  signIn: [method: CloudSignInMethod]
  reopenBrowser: []
  cancel: []
}>()

const ui = cloudConnect()
const t = useCloudMessages()
const common = useCommonMessages()
const errors = computed<Record<CloudConnectError, { heading: string; description: string }>>(
  () => ({
    'invalid-address': {
      heading: t.value.errorInvalidAddressHeading,
      description: t.value.errorInvalidAddressDescription
    },
    unreachable: {
      heading: t.value.errorUnreachableHeading,
      description: t.value.errorUnreachableDescription
    },
    'not-cloud': {
      heading: t.value.errorNotCloudHeading,
      description: t.value.errorNotCloudDescription
    },
    outdated: {
      heading: t.value.errorOutdatedHeading,
      description: t.value.errorOutdatedDescription
    },
    denied: { heading: t.value.errorDeniedHeading, description: t.value.errorDeniedDescription },
    expired: { heading: t.value.errorExpiredHeading, description: t.value.errorExpiredDescription },
    'sign-in-failed': {
      heading: t.value.errorSignInFailedHeading,
      description: t.value.errorSignInFailedDescription
    }
  })
)
const methodLabels = computed<Record<CloudSignInMethod, string>>(() => ({
  google: t.value.continueWithGoogle,
  apple: t.value.continueWithApple,
  email: t.value.continueWithEmail
}))
const heading = computed(() => (step === 'device' ? t.value.deviceHeading : t.value.connectHeading))
const description = computed(() => {
  const host = server?.host
  if (step === 'device')
    return host ? t.value.deviceDescription({ host }) : t.value.deviceDescriptionNoHost
  if (step === 'sign-in')
    return host ? t.value.signInDescription({ host }) : t.value.signInDescriptionNoHost
  return t.value.connectDescription
})
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader :heading="heading" :description="description" :close-label="common.close" />

    <AppDialogBody v-if="step === 'server' || step === 'checking'">
      <RadioGroupRoot v-model="kind" :aria-label="t.server" :class="ui.choices()">
        <RadioGroupItem value="official" :class="ui.choice()">
          <span :class="ui.choiceIcon()"><icon-lucide-cloud class="size-4" /></span>
          <span :class="ui.choiceBody()">
            <span :class="ui.choiceLabel()">{{ t.productName }}</span>
            <span :class="ui.choiceDescription()">{{
              t.officialDescription({ host: official })
            }}</span>
          </span>
          <span :class="ui.choiceMark()" aria-hidden="true" />
        </RadioGroupItem>
        <RadioGroupItem value="self-hosted" :class="ui.choice()">
          <span :class="ui.choiceIcon()"><icon-lucide-server class="size-4" /></span>
          <span :class="ui.choiceBody()">
            <span :class="ui.choiceLabel()">{{ t.selfHostedLabel }}</span>
            <span :class="ui.choiceDescription()">{{ t.selfHostedDescription }}</span>
          </span>
          <span :class="ui.choiceMark()" aria-hidden="true" />
        </RadioGroupItem>
      </RadioGroupRoot>
      <div v-if="kind === 'self-hosted'" :class="ui.address()">
        <label for="cloud-server-address" :class="ui.addressLabel()">{{ t.serverAddress }}</label>
        <AppInput
          id="cloud-server-address"
          v-model="address"
          type="url"
          inputmode="url"
          autocomplete="url"
          placeholder="https://cloud.example.com"
          :disabled="step === 'checking'"
          :aria-invalid="error ? true : undefined"
        >
          <template #leading><icon-lucide-globe class="size-3.5" /></template>
        </AppInput>
      </div>
      <AppAlert
        v-if="error"
        tone="error"
        :heading="errors[error].heading"
        :description="errors[error].description"
        :ui="{ root: 'mt-3' }"
      />
    </AppDialogBody>

    <AppDialogBody v-else-if="step === 'sign-in' && server">
      <AppAlert
        v-if="error"
        tone="error"
        :heading="errors[error].heading"
        :description="errors[error].description"
        :ui="{ root: 'mb-3' }"
      />
      <div :class="ui.methods()">
        <AppActionRow
          v-for="method in server.methods"
          :key="method"
          @click="emit('signIn', method)"
        >
          <template #leading>
            <icon-ai-google v-if="method === 'google'" class="size-4 text-surface" />
            <icon-ai-apple v-else-if="method === 'apple'" class="size-4 text-surface" />
            <icon-lucide-mail v-else class="size-4 text-surface" />
          </template>
          {{ methodLabels[method] }}
          <template #trailing>
            <icon-lucide-arrow-up-right v-if="desktop" class="size-3.5" />
            <icon-lucide-chevron-right v-else class="size-3.5" />
          </template>
        </AppActionRow>
      </div>
      <p :class="ui.note()">
        {{ desktop ? t.signInNoteDesktop : t.signInNoteBrowser }}
      </p>
    </AppDialogBody>

    <AppDialogBody v-else-if="step === 'device' && device">
      <div :class="ui.device()">
        <p :class="ui.deviceLabel()">{{ t.yourCode }}</p>
        <AppCopyField
          :value="device.code"
          :copy-label="t.copyCode"
          :copied-label="common.copied"
          look="command"
          :ui="{ root: 'w-full py-3 pl-4', value: 'flex-1 text-center text-lg tracking-[0.3em]' }"
        />
        <p :class="ui.deviceStatus()" role="status">
          <icon-lucide-loader-circle :class="ui.spinner()" aria-hidden="true" />
          {{ t.deviceWaiting({ duration: device.expiresIn }) }}
        </p>
      </div>
    </AppDialogBody>

    <AppDialogFooter>
      <template v-if="step === 'device'">
        <AppButton variant="ghost" @click="emit('cancel')">{{ common.cancel }}</AppButton>
        <AppButton variant="outline" @click="emit('reopenBrowser')">
          <template #leading><icon-lucide-external-link class="size-3.5" /></template>
          {{ t.openBrowserAgain }}
        </AppButton>
      </template>
      <template v-else-if="step === 'sign-in'">
        <AppButton variant="ghost" class="mr-auto" @click="emit('changeServer')">
          <template #leading><icon-lucide-arrow-left class="size-3.5" /></template>
          {{ t.useAnotherServer }}
        </AppButton>
        <AppButton variant="ghost" @click="emit('cancel')">{{ common.cancel }}</AppButton>
      </template>
      <template v-else>
        <AppButton variant="ghost" @click="emit('cancel')">{{ common.cancel }}</AppButton>
        <AppButton
          color="primary"
          variant="solid"
          :loading="step === 'checking'"
          :disabled="kind === 'self-hosted' && !address.trim()"
          @click="emit('continue')"
        >
          {{ t.continue }}
        </AppButton>
      </template>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
