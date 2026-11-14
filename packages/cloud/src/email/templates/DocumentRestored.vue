<script setup lang="ts">
import type { DocumentRestoredPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { greeting, useEmailLocalization } from './localization'

/** To a workspace's owner: a document an administrator took down is back. */
const { payload } = defineProps<{ payload: DocumentRestoredPayload }>()

const localization = useEmailLocalization()
const { t } = localization
const document = { document: payload.documentName }
</script>

<template>
  <BrandEmail
    :preview="t.documentRestored(document)"
    :heading="t.documentRestoredHeading"
    :action="{ label: t.openHome, url: payload.actionURL }"
  >
    <EmailText>{{ greeting(localization, payload.name) }}</EmailText>
    <EmailText>{{ t.documentRestored(document) }}</EmailText>
  </BrandEmail>
</template>
