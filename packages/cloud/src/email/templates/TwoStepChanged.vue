<script setup lang="ts">
import { CLOUD_SOCIAL_PROVIDER_NAMES, isKnownSocialProvider } from '#cloud/contract'

import type { TwoStepChange, TwoStepChangedPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { greeting, useEmailLocalization } from './localization'

/**
 * How the account proves it's its owner's changed: an authenticator app, a passkey, or a way to
 * sign in an administrator removed.
 */
const { payload } = defineProps<{ payload: TwoStepChangedPayload }>()

const localization = useEmailLocalization()
const { t } = localization
// Provider names stay as their owners write them; a password is named in the reader's words.
function methodName(provider: string): string {
  if (provider === 'credential') return t.signInMethodPassword
  return isKnownSocialProvider(provider) ? CLOUD_SOCIAL_PROVIDER_NAMES[provider] : provider
}
const method = payload.method ? methodName(payload.method) : ''
const changes: Record<TwoStepChange, { heading: string; message: string }> = {
  'authenticator-on': { heading: t.authenticatorOnHeading, message: t.authenticatorOn },
  'authenticator-off': { heading: t.authenticatorOffHeading, message: t.authenticatorOff },
  'passkey-added': { heading: t.passkeyAddedHeading, message: t.passkeyAdded },
  'passkey-removed': { heading: t.passkeyRemovedHeading, message: t.passkeyRemoved },
  'reset-by-administrator': { heading: t.twoStepResetHeading, message: t.twoStepReset },
  'sign-in-method-removed': {
    heading: t.signInMethodRemovedHeading,
    message: t.signInMethodRemoved({ method })
  }
}
const change = changes[payload.change]
</script>

<template>
  <BrandEmail
    :preview="change.message"
    :heading="change.heading"
    :action="{ label: t.reviewSecurity, url: payload.actionURL }"
  >
    <EmailText>{{ greeting(localization, payload.name) }}</EmailText>
    <EmailText>{{ change.message }}</EmailText>
    <EmailText>{{ t.twoStepNotYou }}</EmailText>
  </BrandEmail>
</template>
