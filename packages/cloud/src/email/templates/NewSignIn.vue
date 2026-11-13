<script setup lang="ts">
import type { NewSignInPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { greeting, useEmailLocalization } from './localization'

/** An account was signed in to from somewhere it never was before. */
const { payload } = defineProps<{ payload: NewSignInPayload }>()

const localization = useEmailLocalization()
const { t, dateTime } = localization

function signedInWith(): string {
  if (payload.desktop) return t.newSignInApp
  const { browser, system } = payload
  if (browser && system) return t.newSignInBrowser({ browser, system })
  return browser ?? system ?? t.newSignInUnknownBrowser
}

const device = signedInWith()
const date = dateTime(payload.signedInAt)
const message = payload.ipAddress
  ? t.newSignInFrom({ device, address: payload.ipAddress, date })
  : t.newSignIn({ device, date })
</script>

<template>
  <BrandEmail
    :preview="t.newSignInPreview({ device })"
    :heading="t.newSignInHeading"
    :action="{ label: t.reviewSessions, url: payload.actionURL }"
  >
    <EmailText>{{ greeting(localization, payload.name) }}</EmailText>
    <EmailText>{{ message }}</EmailText>
    <EmailText>{{ t.newSignInNotYou }}</EmailText>
  </BrandEmail>
</template>
