<script setup lang="ts">
import type { AuthenticationEmailPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { greeting, useEmailLocalization } from './localization'

/** Confirms the address a new account signed up with, or one an account is moving to. */
const { payload } = defineProps<{ payload: AuthenticationEmailPayload }>()

const localization = useEmailLocalization()
const { t } = localization
const copy =
  payload.purpose === 'change'
    ? {
        preview: t.verifyChangePreview,
        heading: t.verifyChangeHeading,
        message: t.verifyChange,
        note: t.verifyChangeNote
      }
    : {
        preview: t.verifyAccountPreview,
        heading: t.verifyAccountHeading,
        message: t.verifyAccount,
        note: t.verifyAccountNote
      }
</script>

<template>
  <BrandEmail
    :preview="copy.preview"
    :heading="copy.heading"
    :action="{ label: t.verifyAction, url: payload.actionURL ?? '#' }"
  >
    <EmailText>{{ greeting(localization, payload.name) }}</EmailText>
    <EmailText>{{ copy.message }}</EmailText>
    <template #note>{{ copy.note }}</template>
  </BrandEmail>
</template>
