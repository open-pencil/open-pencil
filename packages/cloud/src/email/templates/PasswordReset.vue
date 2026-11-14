<script setup lang="ts">
import type { AuthenticationEmailPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { greeting, useEmailLocalization } from './localization'

const { payload } = defineProps<{ payload: AuthenticationEmailPayload }>()

const localization = useEmailLocalization()
const { t } = localization
</script>

<template>
  <BrandEmail
    :preview="t.passwordResetPreview"
    :heading="t.passwordResetHeading"
    :action="{ label: t.passwordResetAction, url: payload.actionURL ?? '#' }"
  >
    <EmailText>{{ greeting(localization, payload.name) }}</EmailText>
    <EmailText>{{ t.passwordReset }}</EmailText>
    <template #note>{{ t.passwordResetNote }}</template>
  </BrandEmail>
</template>
