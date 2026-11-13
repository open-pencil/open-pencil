<script setup lang="ts">
import type { EnrollmentEmailPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { greeting, useEmailLocalization } from './localization'

/** Where an access request stands, to the person who made it. */
const { kind, payload } = defineProps<{
  kind: 'requested' | 'approved' | 'rejected' | 'revoked'
  payload: EnrollmentEmailPayload
}>()

const localization = useEmailLocalization()
const { t } = localization
const copy = {
  requested: {
    preview: t.enrollmentRequestedPreview,
    heading: t.enrollmentRequestedHeading,
    message: t.enrollmentRequested,
    action: t.openCloud
  },
  approved: {
    preview: t.enrollmentApprovedPreview,
    heading: t.enrollmentApprovedHeading,
    message: t.enrollmentApproved,
    action: t.enrollmentApprovedAction
  },
  rejected: {
    preview: t.enrollmentRejectedPreview,
    heading: t.enrollmentRejectedHeading,
    message: t.enrollmentRejected,
    action: t.enrollmentRejectedAction
  },
  revoked: {
    preview: t.enrollmentRevokedPreview,
    heading: t.enrollmentRevokedHeading,
    message: t.enrollmentRevoked,
    action: t.enrollmentRevokedAction
  }
}[kind]
</script>

<template>
  <BrandEmail
    :preview="copy.preview"
    :heading="copy.heading"
    :action="{ label: copy.action, url: payload.actionURL }"
  >
    <EmailText>{{ greeting(localization, payload.name) }}</EmailText>
    <EmailText>{{ copy.message }}</EmailText>
  </BrandEmail>
</template>
