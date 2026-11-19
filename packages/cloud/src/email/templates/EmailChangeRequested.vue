<script setup lang="ts">
import type { EmailChangeRequestedPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { greeting, useEmailLocalization } from './localization'

/** To the address being replaced: which address is taking over, before it confirms. */
const { payload } = defineProps<{ payload: EmailChangeRequestedPayload }>()

const localization = useEmailLocalization()
const { t } = localization
</script>

<template>
  <BrandEmail
    :preview="t.emailChangePreview({ email: payload.newEmail })"
    :heading="t.emailChangeHeading"
    :action="{ label: t.reviewAccount, url: payload.actionURL }"
  >
    <EmailText>{{ greeting(localization, payload.name) }}</EmailText>
    <EmailText>{{ t.emailChange({ email: payload.newEmail }) }}</EmailText>
    <EmailText>{{ t.emailChangeNotYou }}</EmailText>
  </BrandEmail>
</template>
