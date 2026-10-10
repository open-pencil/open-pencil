<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { computed } from 'vue'

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
const errors: Record<CloudConnectError, { heading: string; description: string }> = {
  'invalid-address': {
    heading: 'Enter the server’s web address',
    description: 'Use the address your team gave you, such as https://cloud.example.com.'
  },
  unreachable: {
    heading: 'Couldn’t reach this server',
    description: 'Check the address and your connection, then try again.'
  },
  'not-cloud': {
    heading: 'This isn’t an OpenPencil Cloud server',
    description:
      'The address answered, but not as OpenPencil Cloud. Ask your team for the right one.'
  },
  outdated: {
    heading: 'This server needs an update',
    description: 'It runs an older version of OpenPencil Cloud than this app supports.'
  }
}
const methodLabels: Record<CloudSignInMethod, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
  email: 'Continue with email'
}
const heading = computed(() =>
  step === 'device' ? 'Confirm in your browser' : 'Connect to OpenPencil Cloud'
)
const description = computed(() => {
  if (step === 'device') return `Approve this sign-in on ${server?.host ?? 'the server'}.`
  if (step === 'sign-in') return `Sign in to ${server?.host ?? 'the server'} to sync your files.`
  return 'Keep files in sync across devices and invite people to edit with you.'
})
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader :heading="heading" :description="description" close-label="Close" />

    <AppDialogBody v-if="step === 'server' || step === 'checking'">
      <RadioGroupRoot v-model="kind" aria-label="Server" :class="ui.choices()">
        <RadioGroupItem value="official" :class="ui.choice()">
          <span :class="ui.choiceIcon()"><icon-lucide-cloud class="size-4" /></span>
          <span :class="ui.choiceBody()">
            <span :class="ui.choiceLabel()">OpenPencil Cloud</span>
            <span :class="ui.choiceDescription()">Hosted by OpenPencil · {{ official }}</span>
          </span>
          <span :class="ui.choiceMark()" aria-hidden="true" />
        </RadioGroupItem>
        <RadioGroupItem value="self-hosted" :class="ui.choice()">
          <span :class="ui.choiceIcon()"><icon-lucide-server class="size-4" /></span>
          <span :class="ui.choiceBody()">
            <span :class="ui.choiceLabel()">Your team’s server</span>
            <span :class="ui.choiceDescription()">A self-hosted OpenPencil Cloud</span>
          </span>
          <span :class="ui.choiceMark()" aria-hidden="true" />
        </RadioGroupItem>
      </RadioGroupRoot>
      <div v-if="kind === 'self-hosted'" :class="ui.address()">
        <label for="cloud-server-address" :class="ui.addressLabel()">Server address</label>
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
        {{
          desktop
            ? 'Your browser opens to finish signing in, then you come back here.'
            : 'You come back to this tab after signing in.'
        }}
      </p>
    </AppDialogBody>

    <AppDialogBody v-else-if="step === 'device' && device">
      <div :class="ui.device()">
        <p :class="ui.deviceLabel()">Your code</p>
        <AppCopyField
          :value="device.code"
          copy-label="Copy code"
          copied-label="Copied"
          look="command"
          :ui="{ root: 'w-full py-3 pl-4', value: 'flex-1 text-center text-lg tracking-[0.3em]' }"
        />
        <p :class="ui.deviceStatus()" role="status">
          <icon-lucide-loader-circle :class="ui.spinner()" aria-hidden="true" />
          Waiting for you to approve… The code expires in {{ device.expiresIn }}.
        </p>
      </div>
    </AppDialogBody>

    <AppDialogFooter>
      <template v-if="step === 'device'">
        <AppButton variant="ghost" @click="emit('cancel')">Cancel</AppButton>
        <AppButton variant="outline" @click="emit('reopenBrowser')">
          <template #leading><icon-lucide-external-link class="size-3.5" /></template>
          Open browser again
        </AppButton>
      </template>
      <template v-else-if="step === 'sign-in'">
        <AppButton variant="ghost" class="mr-auto" @click="emit('changeServer')">
          <template #leading><icon-lucide-arrow-left class="size-3.5" /></template>
          Use another server
        </AppButton>
        <AppButton variant="ghost" @click="emit('cancel')">Cancel</AppButton>
      </template>
      <template v-else>
        <AppButton variant="ghost" @click="emit('cancel')">Cancel</AppButton>
        <AppButton
          color="primary"
          variant="solid"
          :loading="step === 'checking'"
          :disabled="kind === 'self-hosted' && !address.trim()"
          @click="emit('continue')"
        >
          Continue
        </AppButton>
      </template>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
