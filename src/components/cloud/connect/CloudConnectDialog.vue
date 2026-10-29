<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { useCloudMessages, useCloudPortalMessages, useCommonMessages } from '@open-pencil/vue/i18n'

import {
  cloudAuthFailureMessage,
  type CloudAccountCredentials
} from '@/app/cloud/sessions/account-form'
import CloudAccountForm from '@/components/cloud/account/CloudAccountForm.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppCopyField from '@/components/ui/input/AppCopyField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppActionRow from '@/components/ui/list/AppActionRow.vue'
import cloudConnectTheme from '@/theme/cloud/connect'

import type {
  CloudAuthFailure,
  CloudConnectError,
  CloudConnectServer,
  CloudConnectStep,
  CloudServerKind,
  CloudSignInMethod
} from './types'

const cloudConnect = tv(cloudConnectTheme)

/**
 * Connecting the editor to an OpenPencil Cloud server and signing in: the server's address when
 * none was chosen yet, then email and password right here, or a provider in the browser. The
 * desktop app and other editors approve a one-time code in the browser for providers.
 */
const {
  step,
  official,
  choosing = true,
  server = null,
  error = null,
  failure = null,
  busy = false,
  email = '',
  resent = false,
  device = null,
  desktop = false,
  canGoBack = false
} = defineProps<{
  step: CloudConnectStep
  /** The hosted service's address, offered as the first choice. */
  official: string
  /** Whether to ask which server; false when the person already chose one. */
  choosing?: boolean
  /** The server that answered, once checked. */
  server?: CloudConnectServer | null
  error?: CloudConnectError | null
  /** Why the last email sign-in, sign-up, or resend failed. */
  failure?: CloudAuthFailure | null
  busy?: boolean
  /** Where the verification link went. */
  email?: string
  resent?: boolean
  /** The code the desktop app asks the person to confirm in the browser. */
  device?: { code: string; expiresIn: string } | null
  desktop?: boolean
  canGoBack?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })
const kind = defineModel<CloudServerKind>('kind', { default: 'official' })
const address = defineModel<string>('address', { default: '' })
const emit = defineEmits<{
  continue: []
  back: []
  signIn: [method: CloudSignInMethod]
  signInWithEmail: [credentials: CloudAccountCredentials]
  signUp: [credentials: CloudAccountCredentials]
  showSignUp: []
  verified: []
  resend: []
  forgotPassword: []
  reopenBrowser: []
  cancel: []
}>()

const FORM_ID = 'cloud-connect-account'
const ui = cloudConnect()
const t = useCloudMessages()
const portal = useCloudPortalMessages()
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
const heading = computed(() => {
  switch (step) {
    case 'device':
      return t.value.deviceHeading
    case 'sign-in':
      return kind.value === 'official'
        ? t.value.signInHeading({ name: t.value.productName })
        : t.value.signIn
    case 'sign-up':
      return portal.value.signUpTitle
    case 'verify':
      return portal.value.checkEmailTitle
    default:
      return choosing ? t.value.connectHeading : t.value.connectServerHeading
  }
})
const description = computed(() => {
  const host = server?.host
  switch (step) {
    case 'device':
      return host ? t.value.deviceDescription({ host }) : t.value.deviceDescriptionNoHost
    case 'sign-in':
      return kind.value === 'official' || !host
        ? t.value.connectDescription
        : t.value.onHost({ host })
    case 'sign-up':
      return host ? t.value.onHost({ host }) : undefined
    case 'verify':
      return t.value.verifyDescription({ email })
    default:
      return choosing ? t.value.connectDescription : t.value.connectServerDescription
  }
})
const failureMessage = computed(() =>
  failure ? cloudAuthFailureMessage(failure, portal.value) : null
)
const mode = computed(() => (step === 'sign-up' ? 'sign-up' : 'sign-in'))

function submitAccount(credentials: CloudAccountCredentials) {
  if (step === 'sign-up') emit('signUp', credentials)
  else emit('signInWithEmail', credentials)
}
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader :heading="heading" :description="description" :close-label="common.close" />

    <AppDialogBody v-if="step === 'server' || step === 'checking'">
      <RadioGroupRoot v-if="choosing" v-model="kind" :aria-label="t.server" :class="ui.choices()">
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
      <form
        v-if="kind === 'self-hosted'"
        :class="choosing ? ui.address() : ui.addressAlone()"
        novalidate
        @submit.prevent="emit('continue')"
      >
        <label for="cloud-server-address" :class="ui.addressLabel()">{{ t.serverAddress }}</label>
        <AppInput
          id="cloud-server-address"
          v-model="address"
          type="url"
          inputmode="url"
          autocomplete="url"
          placeholder="https://cloud.example.com"
          :autofocus="!choosing"
          :disabled="step === 'checking'"
          :aria-invalid="error ? true : undefined"
        >
          <template #leading><icon-lucide-globe class="size-3.5" /></template>
        </AppInput>
      </form>
      <p v-else-if="!choosing && step === 'checking'" :class="ui.deviceStatus()" role="status">
        <icon-lucide-loader-circle :class="ui.spinner()" aria-hidden="true" />
        {{ t.checkingServer }}
      </p>
      <AppAlert
        v-if="error"
        tone="error"
        :heading="errors[error].heading"
        :description="errors[error].description"
        :ui="{ root: 'mt-3' }"
      />
    </AppDialogBody>

    <AppDialogBody v-else-if="(step === 'sign-in' || step === 'sign-up') && server">
      <div :class="ui.stack()">
        <AppAlert
          v-if="error"
          tone="error"
          :heading="errors[error].heading"
          :description="errors[error].description"
        />
        <AppAlert
          v-if="step === 'sign-up' && server.approvalRequired"
          tone="info"
          :heading="portal.approvalTitle"
          :description="portal.approvalDescription"
        />
        <AppAlert v-if="failureMessage" tone="error" :heading="failureMessage" />
        <div v-if="step === 'sign-in' && server.methods.length" :class="ui.methods()">
          <AppActionRow
            v-for="method in server.methods"
            :key="method"
            :disabled="busy"
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
        <div
          v-if="step === 'sign-in' && server.methods.length && server.emailPassword"
          :class="ui.divider()"
        >
          <span :class="ui.dividerLine()" />{{ portal.or }}<span :class="ui.dividerLine()" />
        </div>
        <CloudAccountForm
          v-if="server.emailPassword"
          :id="FORM_ID"
          :mode="mode"
          :minimum-password-length="server.emailPassword.minimumPasswordLength"
          :disabled="busy"
          @submit="submitAccount"
          @forgot-password="emit('forgotPassword')"
        />
        <p v-if="server.emailPassword?.signUp" :class="ui.switch()">
          {{ step === 'sign-up' ? portal.haveAccount : portal.newHere }}
          <AppButton
            size="xs"
            variant="link"
            :disabled="busy"
            @click="step === 'sign-up' ? emit('back') : emit('showSignUp')"
          >
            {{ step === 'sign-up' ? portal.signIn : portal.createAnAccount }}
          </AppButton>
        </p>
        <p v-else-if="!server.emailPassword" :class="ui.note()">
          {{ desktop ? t.signInNoteDesktop : t.signInNoteBrowser }}
        </p>
      </div>
    </AppDialogBody>

    <AppDialogBody v-else-if="step === 'verify'">
      <div :class="ui.stack()">
        <div :class="ui.verify()">
          <span :class="ui.verifyIcon()"><icon-lucide-mail-check class="size-5" /></span>
          <p :class="ui.verifyText()">{{ t.verifyNote }}</p>
        </div>
        <AppAlert
          v-if="failure === 'email-not-verified'"
          tone="warning"
          :heading="t.verifyNotYet"
        />
        <AppAlert v-else-if="failureMessage" tone="error" :heading="failureMessage" />
        <p :class="ui.switch()">
          {{ t.verifyNoEmail }}
          <AppButton size="xs" variant="link" :disabled="busy || resent" @click="emit('resend')">
            {{ resent ? portal.sent : portal.sendAgain }}
          </AppButton>
        </p>
      </div>
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

    <AppDialogFooter :ui="{ footer: 'justify-between' }">
      <AppButton v-if="canGoBack" :disabled="busy" @click="emit('back')">
        {{ common.back }}
      </AppButton>
      <AppButton v-else @click="emit('cancel')">{{ common.cancel }}</AppButton>

      <AppButton v-if="step === 'device'" variant="outline" @click="emit('reopenBrowser')">
        <template #leading><icon-lucide-external-link class="size-3.5" /></template>
        {{ t.openBrowserAgain }}
      </AppButton>
      <AppButton
        v-else-if="(step === 'sign-in' || step === 'sign-up') && server?.emailPassword"
        type="submit"
        :form="FORM_ID"
        color="primary"
        variant="solid"
        :loading="busy"
      >
        {{ step === 'sign-up' ? portal.createAccount : t.signIn }}
      </AppButton>
      <AppButton
        v-else-if="step === 'verify'"
        color="primary"
        variant="solid"
        :loading="busy"
        @click="emit('verified')"
      >
        {{ t.continue }}
      </AppButton>
      <AppButton
        v-else-if="step === 'server' || step === 'checking'"
        color="primary"
        variant="solid"
        :loading="step === 'checking'"
        :disabled="kind === 'self-hosted' && !address.trim()"
        @click="emit('continue')"
      >
        {{ t.continue }}
      </AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
