<script setup lang="ts">
import type { TwoStepChange, TwoStepChangedPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { greeting, useEmailLocalization } from './localization'

/** How the account proves it's its owner's changed: an authenticator app or a passkey. */
const { payload } = defineProps<{ payload: TwoStepChangedPayload }>()

const localization = useEmailLocalization()
const { t } = localization
const changes: Record<TwoStepChange, { heading: string; message: string }> = {
  'authenticator-on': { heading: t.authenticatorOnHeading, message: t.authenticatorOn },
  'authenticator-off': { heading: t.authenticatorOffHeading, message: t.authenticatorOff },
  'passkey-added': { heading: t.passkeyAddedHeading, message: t.passkeyAdded },
  'passkey-removed': { heading: t.passkeyRemovedHeading, message: t.passkeyRemoved },
  'reset-by-administrator': { heading: t.twoStepResetHeading, message: t.twoStepReset }
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
