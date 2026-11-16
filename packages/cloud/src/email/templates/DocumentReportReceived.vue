<script setup lang="ts">
import type { DocumentReportReceivedPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { useEmailLocalization } from './localization'

/** To whoever reported a document: their report arrived, and they'll hear the decision. */
const { payload } = defineProps<{ payload: DocumentReportReceivedPayload }>()

const { t } = useEmailLocalization()
const document = { document: payload.documentName }
</script>

<template>
  <BrandEmail :preview="t.reportReceived(document)" :heading="t.reportReceivedHeading">
    <EmailText>{{ t.reportReceived(document) }}</EmailText>
  </BrandEmail>
</template>
