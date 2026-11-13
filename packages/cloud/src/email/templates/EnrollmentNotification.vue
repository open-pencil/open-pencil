<script setup lang="ts">
import type { AdminEnrollmentNotificationPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { useEmailLocalization } from './localization'

/** To administrators: someone asked for access, in their own words. */
const { payload } = defineProps<{ payload: AdminEnrollmentNotificationPayload }>()

const { t } = useEmailLocalization()
</script>

<template>
  <BrandEmail
    :preview="t.enrollmentNotificationPreview({ email: payload.requesterEmail })"
    :heading="t.enrollmentNotificationHeading"
    :action="{ label: t.enrollmentNotificationAction, url: payload.actionURL }"
  >
    <EmailText>
      {{ t.enrollmentNotification({ name: payload.requesterName, email: payload.requesterEmail }) }}
    </EmailText>
    <EmailText>{{ payload.reason }}</EmailText>
  </BrandEmail>
</template>
